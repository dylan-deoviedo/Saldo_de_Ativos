"""
Motor da estratégia Teste: indicadores técnicos, tendência, probabilidades
estilo ensemble e contexto de tickets (abertos + histórico recente no payload).
Sem dependências fora da stdlib.
"""
from __future__ import annotations

import math
from typing import Any


def _sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def _ema_series(closes: list[float], span: int) -> list[float]:
    if not closes:
        return []
    k = 2.0 / (span + 1)
    out = [closes[0]]
    for i in range(1, len(closes)):
        out.append(closes[i] * k + out[-1] * (1 - k))
    return out


def _rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    gains: list[float] = []
    losses: list[float] = []
    for i in range(len(closes) - period, len(closes)):
        delta = closes[i] - closes[i - 1]
        gains.append(max(delta, 0.0))
        losses.append(max(-delta, 0.0))
    avg_g = sum(gains) / period
    avg_l = sum(losses) / period
    if avg_l < 1e-12:
        return 100.0
    rs = avg_g / avg_l
    return 100.0 - (100.0 / (1.0 + rs))


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = sum(values) / len(values)
    v = sum((x - m) ** 2 for x in values) / (len(values) - 1)
    return math.sqrt(max(v, 0.0))


def _sigmoid(x: float) -> float:
    if x > 20:
        return 1.0
    if x < -20:
        return 0.0
    return 1.0 / (1.0 + math.exp(-x))


def _ticket_features(
    tickets: list[dict[str, Any]], symbol: str
) -> dict[str, float]:
    """Agrega P&L e contagem por símbolo / globais para viés de contexto."""
    sym_u = symbol.upper()
    open_profit = 0.0
    open_n = 0
    closed_profit = 0.0
    closed_n = 0
    for t in tickets:
        und = str(t.get("underlying", "") or "").upper()
        st = str(t.get("status", "open") or "open").lower()
        pr = float(t.get("profit", 0) or 0)
        if und and und != sym_u and sym_u not in und:
            continue
        if st == "open":
            open_profit += pr
            open_n += 1
        else:
            closed_profit += pr
            closed_n += 1
    return {
        "open_profit_sum": open_profit,
        "open_count": float(open_n),
        "closed_profit_sum": closed_profit,
        "closed_count": float(closed_n),
    }


def compute_teste_signal(
    *,
    symbol: str,
    candles: list[dict[str, Any]],
    tickets: list[dict[str, Any]],
    chart_granularity_seconds: int,
    trade_duration_label: str = "",
) -> dict[str, Any]:
    """
    Retorna sinal CALL / PUT / HOLD com probabilidades e indicadores.
    """
    closes: list[float] = []
    for c in candles:
        try:
            closes.append(float(c.get("close", c.get("c", 0))))
        except (TypeError, ValueError):
            continue

    n = len(closes)
    indicators: dict[str, Any] = {
        "candles_used": n,
        "chart_granularity_seconds": chart_granularity_seconds,
        "trade_duration_label": trade_duration_label or None,
    }

    if n < 8:
        return {
            "signal": "HOLD",
            "confidence": 0.0,
            "probability_call": 0.5,
            "probability_put": 0.5,
            "indicators": indicators,
            "rationale": "Poucas velas para indicadores — aguardando histórico.",
        }

    rsi = _rsi(closes, 14)
    indicators["rsi_14"] = round(rsi, 2) if rsi is not None else None

    ema12 = _ema_series(closes, 12)
    ema26 = _ema_series(closes, 26)
    macd_line = ema12[-1] - ema26[-1]
    indicators["macd_histogram"] = round(macd_line, 6)

    sma20 = _sma(closes, min(20, n))
    last = closes[-1]
    z_trend = 0.0
    if sma20 is not None:
        sd = _stdev(closes[-min(20, n) :])
        if sd > 1e-12:
            z_trend = (last - sma20) / sd
        indicators["sma20"] = round(sma20, 5)
    indicators["z_score_vs_sma20"] = round(z_trend, 3)

    mom = (last - closes[max(0, n - 6)]) / last if last else 0.0
    indicators["momentum_6"] = round(mom * 100, 3)

    # Scores normalizados aproximadamente em [-1, 1]
    rsi_score = 0.0
    if rsi is not None:
        rsi_score = (rsi - 50.0) / 50.0

    macd_norm = math.tanh(macd_line / (abs(last) * 0.001 + 1e-9))
    mom_norm = math.tanh(mom * 50.0)

    tf = _ticket_features(tickets, symbol)
    indicators["tickets"] = {k: round(v, 4) if isinstance(v, float) else v for k, v in tf.items()}

    ticket_bias = 0.0
    if tf["open_count"] > 0:
        ticket_bias -= math.tanh(tf["open_profit_sum"] / (tf["open_count"] + 1.0))
    if tf["closed_count"] > 0:
        ticket_bias -= 0.3 * math.tanh(tf["closed_profit_sum"] / (tf["closed_count"] + 1.0))

    # Ensemble: peso para CALL (subir) vs PUT (descer)
    raw_long = (
        0.35 * rsi_score
        + 0.25 * macd_norm
        + 0.25 * mom_norm
        + 0.15 * z_trend
        + 0.10 * ticket_bias
    )
    p_call = _sigmoid(raw_long * 2.8)
    p_put = _sigmoid(-raw_long * 2.8)

    s = p_call + p_put
    if s > 1e-9:
        p_call /= s
        p_put /= s

    confidence = max(p_call, p_put)
    margin = abs(p_call - p_put)

    signal = "HOLD"
    rationale_parts = [
        f"RSI≈{indicators.get('rsi_14')}",
        f"MACD_hist≈{indicators.get('macd_histogram')}",
        f"mom6≈{indicators.get('momentum_6')}%",
    ]

    if confidence >= 0.52 and margin >= 0.06:
        if p_call > p_put:
            signal = "CALL"
            rationale_parts.append("ensemble favorece alta")
        else:
            signal = "PUT"
            rationale_parts.append("ensemble favorece baixa")
    else:
        rationale_parts.append("margem ou confiança baixa — HOLD")

    rationale = "; ".join(str(x) for x in rationale_parts if x)

    return {
        "signal": signal,
        "confidence": round(confidence, 4),
        "probability_call": round(float(p_call), 4),
        "probability_put": round(float(p_put), 4),
        "indicators": indicators,
        "rationale": rationale,
    }
