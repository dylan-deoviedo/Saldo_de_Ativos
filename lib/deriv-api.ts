/** Base URL do FastAPI (sem barra final). */
export function getDerivApiBase(): string {
  return (process.env.NEXT_PUBLIC_DERIV_API_URL ?? "http://192.168.13.140:8000").replace(
    /\/$/,
    ""
  )
}

export function getDerivStreamWsUrl(sessionId: string): string {
  const base = getDerivApiBase()
  const u = new URL(base)
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:"
  return `${wsProto}//${u.host}/api/v1/sessions/${sessionId}/stream`
}

/** Sessão inexistente no FastAPI (ex.: backend reiniciou e a memória zerou). */
export const DERIV_SESSION_NOT_FOUND = "DERIV_SESSION_NOT_FOUND"

export function isSessionNotFoundError(e: unknown): boolean {
  return e instanceof Error && e.message === DERIV_SESSION_NOT_FOUND
}

function parseErrorDetail(detail: unknown): string {
  if (typeof detail === "string") return detail
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (typeof e === "object" && e && "msg" in e ? String((e as { msg: string }).msg) : JSON.stringify(e)))
      .join("; ")
  }
  return "Erro na API"
}

export async function apiCreateSession(token: string): Promise<{
  session_id: string
  loginid?: string | null
  currency?: string | null
}> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
  return data
}

export async function apiDeleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/sessions/${sessionId}`, {
    method: "DELETE",
  })
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}))
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
}

export interface SessionSnapshotDto {
  connected: boolean
  error: string | null
  balance: {
    balance: number
    currency: string
    loginid: string
  } | null
  accounts: Array<{
    loginid: string
    is_virtual: boolean
    currency: string
  }>
  assets: Array<{
    symbol: string
    display_name: string
    market: string
    market_display_name: string
    submarket: string
    submarket_display_name: string
  }>
  tickets: Array<{
    contract_id: number
    contract_type: string
    currency: string
    buy_price: number
    sell_price: number
    profit: number
    profit_percentage: number
    payout: number
    purchase_time: number
    expiry_time: number
    underlying: string
    underlying_display_name: string
    status: "open" | "sold" | "won" | "lost"
    longcode: string
  }>
}

export async function apiGetSnapshot(sessionId: string): Promise<SessionSnapshotDto> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/sessions/${sessionId}/snapshot`)
  const data = await res.json().catch(() => ({}))
  if (res.status === 404) {
    throw new Error(DERIV_SESSION_NOT_FOUND)
  }
  if (!res.ok) {
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
  return data
}

export async function apiRefresh(sessionId: string): Promise<void> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/sessions/${sessionId}/refresh`, {
    method: "POST",
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 404) {
    throw new Error(DERIV_SESSION_NOT_FOUND)
  }
  if (!res.ok) {
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
}

export async function apiSendPayload(sessionId: string, payload: object): Promise<void> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/sessions/${sessionId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 404) {
    throw new Error(DERIV_SESSION_NOT_FOUND)
  }
  if (!res.ok) {
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
}

export type HistoryResponse =
  | { style: "candles"; candles: Array<{ time: number; open: number; high: number; low: number; close: number }> }
  | { style: "ticks"; ticks: Array<{ time: number; price: number }> }
  | { style: string; raw?: unknown }

export async function apiTicksHistory(
  sessionId: string,
  body: { symbol: string; count: number; granularity?: number; subscribe?: boolean }
): Promise<HistoryResponse> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/sessions/${sessionId}/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      symbol: body.symbol,
      count: body.count,
      granularity: body.granularity,
      subscribe: body.subscribe ?? false,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 404) {
    throw new Error(DERIV_SESSION_NOT_FOUND)
  }
  if (!res.ok) {
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
  return data as HistoryResponse
}

/** Robô Teste: análise Python (indicadores + tickets + velas). */
export interface AnalyzeTestePayload {
  symbol: string
  candles: Array<{ time: number; open: number; high: number; low: number; close: number }>
  tickets: Array<{
    contract_id: number
    underlying: string
    contract_type: string
    profit: number
    status: string
    buy_price: number
    longcode: string
  }>
  chart_granularity_seconds: number
  trade_duration_label: string
}

export interface AnalyzeTesteResult {
  signal: "CALL" | "PUT" | "HOLD"
  confidence: number
  probability_call: number
  probability_put: number
  indicators: Record<string, unknown>
  rationale: string
}

export async function apiAnalyzeTeste(body: AnalyzeTestePayload): Promise<AnalyzeTesteResult> {
  const res = await fetch(`${getDerivApiBase()}/api/v1/analyze/teste`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(parseErrorDetail(data.detail) || res.statusText)
  }
  return data as AnalyzeTesteResult
}
