/**
 * Sinais determinísticos para robôs (sem aleatoriedade).
 * Timeframe = reflete a granularidade das velas enviadas (deriv de chartGranularitySeconds).
 */

export const TREND_FOLLOWER_ID = "trend-follower"
export const REVERSAL_HUNTER_ID = "reversal-hunter"

/** Velas OHLC alinhadas ao timeframe da Deriv. */
export type OhlcBar = { open: number; high: number; low: number; close: number }

function emaSeries(values: number[], span: number): number[] {
  if (values.length === 0) return []
  const k = 2 / (span + 1)
  const out: number[] = [values[0]]
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k))
  }
  return out
}

function highestHigh(high: number[], i: number, period: number): number | null {
  const lo = i - period + 1
  if (lo < 0) return null
  let m = high[lo]
  for (let j = lo + 1; j <= i; j++) m = Math.max(m, high[j])
  return m
}

function lowestLow(low: number[], i: number, period: number): number | null {
  const lo = i - period + 1
  if (lo < 0) return null
  let m = low[lo]
  for (let j = lo + 1; j <= i; j++) m = Math.min(m, low[j])
  return m
}

function smaMid(high: number[], low: number[], i: number, len: number): number | null {
  const lo = i - len + 1
  if (lo < 0) return null
  let s = 0
  for (let j = lo; j <= i; j++) s += (high[j] + low[j]) / 2
  return s / len
}

/** Parâmetros do indicador ValueChart Efraim (script fornecido). */
export const EFRAIM_DEFAULTS = {
  /** "Numero de Velas" — alinhado ao gráfico (14, 12, -12, 8, -8, 4, -4). */
  length: 14,
  sigTop: 8,
  sigBot: -8,
} as const

/**
 * Valores normalizados do ValueChart Efraim na vela `i` (0 = mais antiga).
 * Replica a lógica do script (varp, varr1–5, lrange, mba, vopen–vclose).
 */
export function valueChartEfraimAt(
  bars: OhlcBar[],
  i: number,
  length: number = EFRAIM_DEFAULTS.length
): { vopen: number; vhigh: number; vlow: number; vclose: number; lrange: number } | null {
  if (i < 0 || i >= bars.length) return null
  const { open, high, low, close } = splitOhlc(bars)
  const varp = Math.round(length / 5)
  const h_f = length > 7

  let lrange: number

  if (h_f) {
    const varaH = highestHigh(high, i, varp)
    const varaL = lowestLow(low, i, varp)
    if (varaH === null || varaL === null) return null
    const vara = varaH - varaL
    const varr1 =
      vara === 0 && varp === 1
        ? i - varp < 0
          ? null
          : Math.abs(close[i] - close[i - varp])
        : vara
    if (varr1 === null) return null

    const hb1 = highestHigh(high, i - varp + 1, varp)
    const lb1 = lowestLow(low, i - varp, varp)
    if (hb1 === null || lb1 === null) return null
    const varb = hb1 - lb1

    const hb2 = highestHigh(high, i - varp * 2, varp)
    const lb2 = lowestLow(low, i - varp * 2, varp)
    if (hb2 === null || lb2 === null) return null
    const varc = hb2 - lb2

    const hb3 = highestHigh(high, i - varp * 3, varp)
    const lb3 = lowestLow(low, i - varp * 3, varp)
    if (hb3 === null || lb3 === null) return null
    const vard = hb3 - lb3

    const hb4 = highestHigh(high, i - varp * 4, varp)
    const lb4 = lowestLow(low, i - varp * 4, varp)
    if (hb4 === null || lb4 === null) return null
    const vare = hb4 - lb4

    const varr2 =
      varb === 0 && varp === 1
        ? i - varp * 2 < 0
          ? null
          : Math.abs(close[i - varp] - close[i - varp * 2])
        : varb
    const varr3 =
      varc === 0 && varp === 1
        ? i - varp * 3 < 0
          ? null
          : Math.abs(close[i - varp * 2] - close[i - varp * 3])
        : varc
    const varr4 =
      vard === 0 && varp === 1
        ? i - varp * 4 < 0
          ? null
          : Math.abs(close[i - varp * 3] - close[i - varp * 4])
        : vard
    const varr5 =
      vare === 0 && varp === 1
        ? i - varp * 5 < 0
          ? null
          : Math.abs(close[i - varp * 4] - close[i - varp * 5])
        : vare

    if (varr2 === null || varr3 === null || varr4 === null || varr5 === null) return null

    lrange = ((varr1 + varr2 + varr3 + varr4 + varr5) / 5) * 0.2
  } else {
    const var0: number[] = []
    for (let j = 0; j < bars.length; j++) {
      if (j < 1) {
        var0.push(0)
        continue
      }
      const cdelta = Math.abs(close[j] - close[j - 1])
      const hl = high[j] - low[j]
      const v = cdelta > hl || hl === 0 ? cdelta : hl
      var0.push(v)
    }
    if (i < 4) return null
    let s0 = 0
    for (let j = i - 4; j <= i; j++) s0 += var0[j]
    lrange = (s0 / 5) * 0.2
  }

  if (!Number.isFinite(lrange) || lrange < 1e-12) return null

  const mba = smaMid(high, low, i, length)
  if (mba === null) return null

  const vopen = (open[i] - mba) / lrange
  const vhigh = (high[i] - mba) / lrange
  const vlow = (low[i] - mba) / lrange
  const vclose = (close[i] - mba) / lrange

  return { vopen, vhigh, vlow, vclose, lrange }
}

function splitOhlc(bars: OhlcBar[]) {
  return {
    open: bars.map((b) => b.open),
    high: bars.map((b) => b.high),
    low: bars.map((b) => b.low),
    close: bars.map((b) => b.close),
  }
}

/**
 * Seguir tendência: sinal principal EMA12 vs EMA26 + preço na EMA12;
 * confirmação obrigatória com EMA3 vs EMA7 (mesma direção).
 */
export function signalTrendFollower(closes: number[]): "CALL" | "PUT" | "HOLD" {
  if (closes.length < 28) return "HOLD"
  const e3 = emaSeries(closes, 3)
  const e7 = emaSeries(closes, 7)
  const e12 = emaSeries(closes, 12)
  const e26 = emaSeries(closes, 26)
  const i = closes.length - 1
  const c = closes[i]
  const fast = e12[i]
  const slow = e26[i]
  const shortFast = e3[i]
  const shortSlow = e7[i]

  if (fast > slow && c >= fast) {
    if (shortFast > shortSlow) return "CALL"
    return "HOLD"
  }
  if (fast < slow && c <= fast) {
    if (shortFast < shortSlow) return "PUT"
    return "HOLD"
  }
  return "HOLD"
}

/**
 * Reversão só com ValueChart Efraim: PUT se vhigh >= sigTop (8); CALL se vlow <= sigBot (-8).
 * Equivale ao script; níveis 12 são extremos desenhados, entrada pedida na linha 8.
 */
export function signalReversalValueChartEfraim(
  bars: OhlcBar[],
  sigTop: number = EFRAIM_DEFAULTS.sigTop,
  sigBot: number = EFRAIM_DEFAULTS.sigBot,
  length: number = EFRAIM_DEFAULTS.length
): "CALL" | "PUT" | "HOLD" {
  if (bars.length < 2) return "HOLD"
  const i = bars.length - 1
  const vc = valueChartEfraimAt(bars, i, length)
  if (!vc) return "HOLD"
  if (vc.vhigh >= sigTop) return "PUT"
  if (vc.vlow <= sigBot) return "CALL"
  return "HOLD"
}

/** Texto para logs (última vela do ValueChart Efraim). */
export function describeReversalEfraimDebug(
  bars: OhlcBar[],
  length: number = EFRAIM_DEFAULTS.length
): string {
  if (bars.length < 2) return `dados insuficientes (n=${bars.length})`
  const i = bars.length - 1
  const vc = valueChartEfraimAt(bars, i, length)
  if (!vc) return `VC Efraim indisponível (n=${bars.length}, length=${length})`
  return `VC Efraim vH=${vc.vhigh.toFixed(2)} vL=${vc.vlow.toFixed(2)} vC=${vc.vclose.toFixed(2)} len=${length}`
}
