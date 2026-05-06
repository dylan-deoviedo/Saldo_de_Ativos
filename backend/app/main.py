from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from typing import Annotated, Any

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.deriv.session import DerivSession
from app.analysis.teste import compute_teste_signal
from app.models import (
    AnalyzeTesteRequest,
    AnalyzeTesteResponse,
    DerivAccountOut,
    DerivAssetOut,
    DerivBalanceOut,
    DerivForwardRequest,
    DerivTicketOut,
    SessionCreate,
    SessionCreated,
    SessionSnapshot,
    TicksHistoryRequest,
)
from app.session_manager import SessionManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def normalize_history_response(data: dict[str, Any]) -> dict[str, Any]:
    if "candles" in data:
        candles = []
        for c in data["candles"]:
            candles.append(
                {
                    "time": c["epoch"],
                    "open": float(c["open"]),
                    "high": float(c["high"]),
                    "low": float(c["low"]),
                    "close": float(c["close"]),
                }
            )
        return {"style": "candles", "candles": candles}
    if "history" in data:
        h = data["history"]
        times = h.get("times") or []
        prices = h.get("prices") or []
        ticks = [
            {"time": int(times[i]), "price": float(prices[i])}
            for i in range(min(len(times), len(prices)))
        ]
        return {"style": "ticks", "ticks": ticks}
    return {"style": "unknown", "raw": data}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.session_manager = SessionManager()
    yield
    await app.state.session_manager.shutdown_all()


app = FastAPI(
    title="Deriv Dashboard API",
    description="Backend Python para conexão Deriv (WebSocket) e dados para o dashboard.",
    version="0.1.0",
    lifespan=lifespan,
)

_settings = get_settings()

if _settings.cors_allow_all:
    # Resolve quase todos os casos de dev (inclui 192.168.13.140:3000 → 192.168.13.140:8000).
    logger.info("CORS: allow_origins=* (defina CORS_ALLOW_ALL=false em produção)")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_private_network=True,
    )
else:
    _dev_origins = [
        "http://192.168.13.140:3000",
        "http://127.0.0.1:3000",
        "http://192.168.13.140:3001",
        "http://127.0.0.1:3001",
        "http://[::1]:3000",
        "http://[::1]:3001",
    ]
    _merged_origins = list(dict.fromkeys([*_dev_origins, *_settings.cors_origin_list]))
    _local_origin_regex = r"https?://(192.168.13.140|127\.0\.0\.1|\[::1\])(:\d+)?$"
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_merged_origins,
        allow_origin_regex=_local_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_private_network=True,
    )


def get_manager() -> SessionManager:
    return app.state.session_manager


def get_session(
    session_id: str, manager: Annotated[SessionManager, Depends(get_manager)]
) -> DerivSession:
    session = manager.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return session


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/api/v1/analyze/teste", response_model=AnalyzeTesteResponse)
async def analyze_teste(body: AnalyzeTesteRequest):
    """
    Estratégia **Teste**: indicadores (RSI, MACD, momentum, z-score), tendência,
    probabilidades e contexto de tickets — alinhado ao timeframe de velas enviado.
    """
    candles_payload = [c.model_dump() for c in body.candles]
    tickets_payload = [t.model_dump() for t in body.tickets]
    out = compute_teste_signal(
        symbol=body.symbol.strip(),
        candles=candles_payload,
        tickets=tickets_payload,
        chart_granularity_seconds=body.chart_granularity_seconds,
        trade_duration_label=body.trade_duration_label.strip(),
    )
    return AnalyzeTesteResponse(**out)


@app.post("/api/v1/sessions", response_model=SessionCreated)
async def create_session(
    body: SessionCreate,
    manager: Annotated[SessionManager, Depends(get_manager)],
):
    try:
        session_id, session = await manager.create(body.token.strip())
    except ConnectionError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except Exception as e:
        logger.exception("Falha ao criar sessão")
        raise HTTPException(status_code=502, detail=str(e)) from e

    bal = session.state.balance
    return SessionCreated(
        session_id=session_id,
        loginid=bal["loginid"] if bal else None,
        currency=bal["currency"] if bal else None,
    )


@app.delete("/api/v1/sessions/{session_id}")
async def delete_session(
    session_id: str,
    manager: Annotated[SessionManager, Depends(get_manager)],
):
    if not await manager.destroy(session_id):
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    return {"ok": True}


@app.get("/api/v1/sessions/{session_id}/snapshot", response_model=SessionSnapshot)
async def session_snapshot(session: Annotated[DerivSession, Depends(get_session)]):
    s = session.snapshot()
    balance = None
    if s["balance"]:
        b = s["balance"]
        balance = DerivBalanceOut(
            balance=float(b["balance"]),
            currency=b["currency"],
            loginid=b["loginid"],
        )
    return SessionSnapshot(
        connected=s["connected"],
        error=s["error"],
        balance=balance,
        accounts=[DerivAccountOut(**a) for a in s["accounts"]],
        assets=[DerivAssetOut(**x) for x in s["assets"]],
        tickets=[DerivTicketOut(**t) for t in s["tickets"]],
    )


@app.post("/api/v1/sessions/{session_id}/refresh")
async def refresh_session(session: Annotated[DerivSession, Depends(get_session)]):
    try:
        await session.refresh_portfolio_balance()
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return {"ok": True}


@app.post("/api/v1/sessions/{session_id}/history")
async def ticks_history(
    session: Annotated[DerivSession, Depends(get_session)],
    body: TicksHistoryRequest,
):
    try:
        raw = await session.request_ticks_history(
            body.symbol,
            body.count,
            body.granularity,
            body.subscribe,
        )
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Timeout na Deriv") from None
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if raw.get("error"):
        raise HTTPException(status_code=400, detail=raw["error"])
    return normalize_history_response(raw)


@app.post("/api/v1/sessions/{session_id}/send")
async def forward_send(
    session: Annotated[DerivSession, Depends(get_session)],
    body: DerivForwardRequest,
):
    try:
        await session.send_payload(body.payload)
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return {"ok": True}


async def _pump_queue_to_ws(
    queue: asyncio.Queue[dict[str, Any]], websocket: WebSocket
):
    while True:
        event = await queue.get()
        await websocket.send_text(json.dumps(event, default=str))


@app.websocket("/api/v1/sessions/{session_id}/stream")
async def session_stream(websocket: WebSocket, session_id: str):
    manager: SessionManager = app.state.session_manager
    session = manager.get(session_id)
    if not session:
        await websocket.close(code=4404)
        return

    await websocket.accept()
    queue = await session.register_client_queue()
    pump = asyncio.create_task(_pump_queue_to_ws(queue, websocket))
    try:
        await websocket.send_json(
            {
                "event": "hello",
                "data": {
                    "session_id": session_id,
                    "assets": list(session.state.assets),
                },
            }
        )
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            action = msg.get("action")
            try:
                if action == "ping":
                    await websocket.send_json({"event": "pong", "data": {}})
                elif action == "subscribe_ticks":
                    sym = msg.get("symbol")
                    if sym:
                        await session.add_tick_subscription(sym)
                elif action == "unsubscribe_ticks":
                    sym = msg.get("symbol")
                    if sym:
                        await session.remove_tick_subscription(sym)
                elif action == "subscribe_candles":
                    sym = msg.get("symbol")
                    gran = msg.get("granularity")
                    if sym and gran is not None:
                        await session.add_candle_subscription(sym, int(gran))
                elif action == "unsubscribe_candles":
                    sym = msg.get("symbol")
                    gran = msg.get("granularity")
                    if sym and gran is not None:
                        await session.remove_candle_subscription(sym, int(gran))
                elif action == "send":
                    payload = msg.get("payload")
                    if isinstance(payload, dict):
                        await session.send_payload(payload)
                else:
                    await websocket.send_json(
                        {
                            "event": "error",
                            "data": {"message": f"Ação desconhecida: {action}"},
                        }
                    )
            except ConnectionError as e:
                await websocket.send_json(
                    {"event": "error", "data": {"message": str(e)}}
                )
    except WebSocketDisconnect:
        pass
    finally:
        pump.cancel()
        try:
            await pump
        except asyncio.CancelledError:
            pass
        await session.unregister_client_queue(queue)
