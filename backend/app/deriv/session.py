from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

import websockets
from websockets.exceptions import ConnectionClosed

from app.config import get_settings

logger = logging.getLogger(__name__)

AUTHORIZE_TIMEOUT_S = 45.0
HISTORY_TIMEOUT_S = 15.0


def _map_portfolio_contract(contract: dict[str, Any]) -> dict[str, Any]:
    return {
        "contract_id": contract["contract_id"],
        "contract_type": contract["contract_type"],
        "currency": contract["currency"],
        "buy_price": contract["buy_price"],
        "sell_price": contract.get("sell_price") or 0,
        "profit": contract.get("profit") or 0,
        "profit_percentage": contract.get("profit_percentage") or 0,
        "payout": contract["payout"],
        "purchase_time": contract["purchase_time"],
        "expiry_time": contract["expiry_time"],
        "underlying": contract["underlying"],
        "underlying_display_name": contract.get("symbol") or contract["underlying"],
        "status": "open",
        "longcode": contract.get("longcode") or "",
    }


@dataclass
class SessionState:
    connected: bool = False
    error: str | None = None
    balance: dict[str, Any] | None = None
    accounts: list[dict[str, Any]] = field(default_factory=list)
    assets: list[dict[str, Any]] = field(default_factory=list)
    tickets: list[dict[str, Any]] = field(default_factory=list)


class DerivSession:
    """One Deriv WebSocket + parsed state + fan-out to API/WebSocket clients."""

    def __init__(self) -> None:
        self.state = SessionState()
        self._ws: Any = None
        self._read_task: asyncio.Task[None] | None = None
        self._send_lock = asyncio.Lock()
        self._closed = False
        self._authorized = asyncio.Event()
        self._auth_error: str | None = None
        self._req_id = 1
        self._pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
        self._subscription_ids: dict[str, str] = {}
        self._tick_refs: dict[str, int] = defaultdict(int)
        self._candle_refs: dict[str, int] = defaultdict(int)
        self._client_queues: list[asyncio.Queue[dict[str, Any]]] = []
        self._queues_lock = asyncio.Lock()

    def snapshot(self) -> dict[str, Any]:
        return {
            "connected": self.state.connected,
            "error": self.state.error,
            "balance": self.state.balance,
            "accounts": list(self.state.accounts),
            "assets": list(self.state.assets),
            "tickets": list(self.state.tickets),
        }

    async def register_client_queue(
        self, maxsize: int = 512
    ) -> asyncio.Queue[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=maxsize)
        async with self._queues_lock:
            self._client_queues.append(q)
        return q

    async def unregister_client_queue(self, q: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._queues_lock:
            if q in self._client_queues:
                self._client_queues.remove(q)

    async def _emit(self, event: dict[str, Any]) -> None:
        async with self._queues_lock:
            queues = list(self._client_queues)
        for q in queues:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                try:
                    _ = q.get_nowait()
                except asyncio.QueueEmpty:
                    pass
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    pass

    async def connect(self, token: str) -> None:
        if self._closed:
            raise RuntimeError("Session already closed")
        settings = get_settings()
        url = settings.deriv_ws_full_url
        self._ws = await websockets.connect(
            url,
            ping_interval=20,
            ping_timeout=20,
            close_timeout=10,
            max_size=16 * 1024 * 1024,
        )
        self._read_task = asyncio.create_task(self._reader_loop())
        await self._send_raw({"authorize": token})
        try:
            await asyncio.wait_for(self._authorized.wait(), AUTHORIZE_TIMEOUT_S)
        except TimeoutError as e:
            await self.close()
            raise ConnectionError("Timeout aguardando authorize da Deriv") from e
        if self._auth_error:
            err = self._auth_error
            await self.close()
            raise ConnectionError(err)

    async def close(self) -> None:
        self._closed = True
        self.state.connected = False
        if self._read_task and not self._read_task.done():
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass
        self._read_task = None
        if self._ws:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None
        for fut in self._pending.values():
            if not fut.done():
                fut.set_exception(ConnectionError("Sessão encerrada"))
        self._pending.clear()

    async def _send_raw(self, payload: dict[str, Any]) -> None:
        if not self._ws or self._closed:
            raise ConnectionError("WebSocket Deriv não conectado")
        async with self._send_lock:
            await self._ws.send(json.dumps(payload))

    async def send_payload(self, payload: dict[str, Any]) -> None:
        """Encaminha um pedido JSON bruto para a Deriv (ex.: proposal, buy)."""
        await self._send_raw(payload)

    async def refresh_portfolio_balance(self) -> None:
        await self._send_raw({"portfolio": 1})
        await self._send_raw({"balance": 1})

    async def add_tick_subscription(self, symbol: str) -> None:
        self._tick_refs[symbol] += 1
        if self._tick_refs[symbol] == 1:
            await self._send_raw({"ticks": symbol, "subscribe": 1})

    async def remove_tick_subscription(self, symbol: str) -> None:
        if symbol not in self._tick_refs:
            return
        self._tick_refs[symbol] -= 1
        if self._tick_refs[symbol] <= 0:
            del self._tick_refs[symbol]
            key = f"tick_{symbol}"
            sub_id = self._subscription_ids.pop(key, None)
            if sub_id:
                await self._send_raw({"forget": sub_id})

    async def add_candle_subscription(self, symbol: str, granularity: int) -> None:
        key = f"{symbol}_{granularity}"
        self._candle_refs[key] += 1
        if self._candle_refs[key] == 1:
            await self._send_raw(
                {
                    "ticks_history": symbol,
                    "style": "candles",
                    "granularity": granularity,
                    "count": 1,
                    "subscribe": 1,
                }
            )

    async def remove_candle_subscription(self, symbol: str, granularity: int) -> None:
        key = f"{symbol}_{granularity}"
        if key not in self._candle_refs:
            return
        self._candle_refs[key] -= 1
        if self._candle_refs[key] <= 0:
            del self._candle_refs[key]
            sid_key = f"candle_{symbol}_{granularity}"
            sub_id = self._subscription_ids.pop(sid_key, None)
            if sub_id:
                await self._send_raw({"forget": sub_id})

    async def request_ticks_history(
        self,
        symbol: str,
        count: int,
        granularity: int | None = None,
        subscribe: bool = False,
    ) -> dict[str, Any]:
        req_id = self._req_id
        self._req_id += 1
        request: dict[str, Any] = {
            "ticks_history": symbol,
            "count": count,
            "end": "latest",
            "req_id": req_id,
        }
        if granularity is not None:
            request["style"] = "candles"
            request["granularity"] = granularity
        else:
            request["style"] = "ticks"
        if subscribe:
            request["subscribe"] = 1

        fut: asyncio.Future[dict[str, Any]] = asyncio.get_running_loop().create_future()
        self._pending[str(req_id)] = fut
        await self._send_raw(request)
        try:
            return await asyncio.wait_for(fut, HISTORY_TIMEOUT_S)
        finally:
            self._pending.pop(str(req_id), None)

    def _resolve_pending(self, data: dict[str, Any]) -> bool:
        rid = data.get("req_id")
        if rid is None:
            return False
        key = str(rid)
        if key not in self._pending:
            return False
        fut = self._pending.pop(key)
        if not fut.done():
            fut.set_result(data)
        return True

    async def _reader_loop(self) -> None:
        assert self._ws is not None
        try:
            async for message in self._ws:
                if self._closed:
                    break
                await self._handle_message(message)
        except ConnectionClosed:
            logger.info("Deriv WebSocket fechado")
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Erro no reader Deriv")
        finally:
            self.state.connected = False
            await self._emit({"event": "session_closed", "data": {}})

    async def _handle_message(self, raw: str | bytes) -> None:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return

        if err := data.get("error"):
            msg = err.get("message", str(err)) if isinstance(err, dict) else str(err)
            self.state.error = msg
            await self._emit(
                {
                    "event": "deriv_error",
                    "data": {"message": msg, "req_id": data.get("req_id")},
                }
            )
            rid = data.get("req_id")
            if rid is not None and str(rid) in self._pending:
                fut = self._pending.pop(str(rid))
                if not fut.done():
                    fut.set_exception(ConnectionError(msg))
            if not self._authorized.is_set():
                self._auth_error = msg
                self._authorized.set()
            return

        if data.get("req_id") is not None and self._resolve_pending(data):
            pass

        msg_type = data.get("msg_type")

        if msg_type == "authorize" and data.get("authorize"):
            a = data["authorize"]
            self.state.error = None
            self.state.connected = True
            self.state.balance = {
                "balance": a["balance"],
                "currency": a["currency"],
                "loginid": a["loginid"],
            }
            self.state.accounts = a.get("account_list") or []
            await self._send_raw({"portfolio": 1})
            await self._send_raw(
                {"active_symbols": "brief", "product_type": "basic"}
            )
            await self._send_raw({"balance": 1, "subscribe": 1})
            self._authorized.set()
            await self._emit(
                {
                    "event": "authorized",
                    "data": {
                        "loginid": a["loginid"],
                        "currency": a["currency"],
                        "balance": a["balance"],
                    },
                }
            )
            return

        if msg_type == "balance" and data.get("balance"):
            b = data["balance"]
            if self.state.balance:
                self.state.balance["balance"] = b["balance"]
                self.state.balance["currency"] = b["currency"]
            await self._emit({"event": "balance", "data": b})
            return

        if msg_type == "active_symbols" and data.get("active_symbols"):
            symbols = data["active_symbols"]
            self.state.assets = [
                {
                    "symbol": s["symbol"],
                    "display_name": s["display_name"],
                    "market": s["market"],
                    "market_display_name": s["market_display_name"],
                    "submarket": s["submarket"],
                    "submarket_display_name": s["submarket_display_name"],
                }
                for s in symbols
            ]
            await self._emit(
                {"event": "active_symbols", "data": {"count": len(self.state.assets)}}
            )
            return

        if msg_type == "portfolio" and data.get("portfolio"):
            contracts = data["portfolio"].get("contracts") or []
            self.state.tickets = [_map_portfolio_contract(c) for c in contracts]
            await self._emit(
                {
                    "event": "portfolio",
                    "data": {"tickets": list(self.state.tickets)},
                }
            )
            return

        if msg_type == "tick" and data.get("tick"):
            t = data["tick"]
            sym = t["symbol"]
            if data.get("subscription", {}).get("id"):
                self._subscription_ids[f"tick_{sym}"] = data["subscription"]["id"]
            await self._emit(
                {
                    "event": "tick",
                    "symbol": sym,
                    "data": {"time": t["epoch"], "price": t["quote"]},
                }
            )
            return

        if msg_type in ("candles", "history"):
            sub = data.get("subscription", {})
            if sub.get("id") and isinstance(data.get("echo_req"), dict):
                er = data["echo_req"]
                sym = er.get("ticks_history")
                gran = er.get("granularity") or 60
                if sym:
                    self._subscription_ids[f"candle_{sym}_{gran}"] = sub["id"]
            await self._emit({"event": msg_type, "data": data})
            return

        if msg_type == "ohlc" and data.get("ohlc"):
            o = data["ohlc"]
            sym = o["symbol"]
            gran = o["granularity"]
            if data.get("subscription", {}).get("id"):
                self._subscription_ids[f"candle_{sym}_{gran}"] = data["subscription"][
                    "id"
                ]
            await self._emit(
                {
                    "event": "ohlc",
                    "symbol": sym,
                    "granularity": gran,
                    "data": {
                        "time": o["open_time"],
                        "open": float(o["open"]),
                        "high": float(o["high"]),
                        "low": float(o["low"]),
                        "close": float(o["close"]),
                    },
                }
            )
            return

        if msg_type == "proposal" and data.get("proposal"):
            await self._emit(
                {
                    "event": "proposal",
                    "req_id": data.get("req_id"),
                    "data": data["proposal"],
                }
            )
            return

        if msg_type == "buy" and data.get("buy"):
            buy = data["buy"]
            await self._emit(
                {"event": "buy", "req_id": data.get("req_id"), "data": buy}
            )
            await self._send_raw(
                {
                    "proposal_open_contract": 1,
                    "contract_id": buy["contract_id"],
                    "subscribe": 1,
                }
            )
            return

        if msg_type == "proposal_open_contract" and data.get("proposal_open_contract"):
            contract = data["proposal_open_contract"]
            await self._emit({"event": "proposal_open_contract", "data": contract})
            st = contract.get("status")
            if st in ("won", "lost", "sold") and data.get("subscription", {}).get("id"):
                await self._send_raw({"forget": data["subscription"]["id"]})
            return

        if msg_type:
            await self._emit({"event": "deriv_message", "data": data})
