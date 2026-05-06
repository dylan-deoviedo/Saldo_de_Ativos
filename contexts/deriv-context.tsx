"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react"
import {
  apiCreateSession,
  apiDeleteSession,
  apiGetSnapshot,
  apiRefresh,
  apiSendPayload,
  apiTicksHistory,
  getDerivStreamWsUrl,
  isSessionNotFoundError,
} from "@/lib/deriv-api"

export interface DerivBalance {
  balance: number
  currency: string
  loginid: string
}

export interface DerivAsset {
  symbol: string
  display_name: string
  market: string
  market_display_name: string
  submarket: string
  submarket_display_name: string
}

export interface DerivTicket {
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
}

export interface DerivAccount {
  loginid: string
  is_virtual: boolean
  currency: string
}

export interface OHLCCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface TickData {
  time: number
  price: number
}

export interface BuyContractResult {
  contract_id: number
  buy_price: number
  balance_after: number
  longcode: string
}

export interface ContractUpdate {
  contract_id: number
  status: "open" | "sold" | "won" | "lost"
  profit: number
  exit_tick?: number
  exit_tick_time?: number
}

interface DerivContextType {
  isConnected: boolean
  isLoading: boolean
  error: string | null
  balance: DerivBalance | null
  assets: DerivAsset[]
  tickets: DerivTicket[]
  accounts: DerivAccount[]
  connect: (token: string) => void
  disconnect: () => void
  refreshData: () => void
  sendRequest: (request: object) => void
  subscribeToTicks: (symbol: string, callback: (tick: TickData) => void) => () => void
  subscribeToCandles: (
    symbol: string,
    granularity: number,
    callback: (candle: OHLCCandle) => void
  ) => () => void
  getTicksHistory: (
    symbol: string,
    count: number,
    granularity?: number,
    subscribe?: boolean
  ) => Promise<OHLCCandle[] | TickData[]>
  onBuyResult: (callback: (result: BuyContractResult) => void) => () => void
  onContractUpdate: (callback: (update: ContractUpdate) => void) => () => void
  /** Pedido proposal (Rise/Fall etc.); aguarda resposta via WebSocket. Requer stream aberto. */
  requestProposal: (params: Record<string, unknown>) => Promise<Record<string, unknown>>
}

const DerivContext = createContext<DerivContextType | null>(null)

export function useDerivContext() {
  const context = useContext(DerivContext)
  if (!context) {
    throw new Error("useDerivContext must be used within a DerivProvider")
  }
  return context
}

interface DerivProviderProps {
  children: ReactNode
}

export function DerivProvider({ children }: DerivProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<DerivBalance | null>(null)
  const [assets, setAssets] = useState<DerivAsset[]>([])
  const [tickets, setTickets] = useState<DerivTicket[]>([])
  const [accounts, setAccounts] = useState<DerivAccount[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const tickSubscriptionsRef = useRef<Map<string, Set<(tick: TickData) => void>>>(new Map())
  const candleSubscriptionsRef = useRef<Map<string, Set<(candle: OHLCCandle) => void>>>(new Map())
  const buyResultCallbacksRef = useRef<Set<(result: BuyContractResult) => void>>(new Set())
  const contractUpdateCallbacksRef = useRef<Set<(update: ContractUpdate) => void>>(new Set())
  const proposalWaitersRef = useRef<
    Map<
      number,
      {
        resolve: (v: Record<string, unknown>) => void
        fail: (e: Error) => void
      }
    >
  >(new Map())
  const tradingReqIdRef = useRef(1)

  const processStreamEventRef = useRef<(msg: Record<string, unknown>) => void>(() => {})

  useEffect(() => {
    processStreamEventRef.current = (msg: Record<string, unknown>) => {
      const ev = msg.event as string
      const data = msg.data

      switch (ev) {
        case "hello": {
          if (data && typeof data === "object" && "assets" in data) {
            const arr = (data as { assets?: DerivAsset[] }).assets
            if (arr && arr.length > 0) setAssets(arr)
          }
          return
        }

        case "pong":
          return

        case "authorized": {
          if (data && typeof data === "object") {
            const d = data as { loginid?: string; currency?: string; balance?: number }
            setBalance({
              loginid: d.loginid ?? "",
              currency: d.currency ?? "",
              balance: Number(d.balance ?? 0),
            })
          }
          return
        }

        case "balance": {
          if (data && typeof data === "object") {
            const b = data as { balance: number; currency: string }
            setBalance((prev) =>
              prev
                ? { ...prev, balance: b.balance, currency: b.currency }
                : {
                    loginid: "",
                    currency: b.currency,
                    balance: b.balance,
                  }
            )
          }
          return
        }

        case "portfolio": {
          if (data && typeof data === "object" && "tickets" in data) {
            setTickets((data as { tickets: DerivTicket[] }).tickets)
          }
          return
        }

        case "proposal": {
          const rid = msg.req_id
          if (rid == null || data == null || typeof data !== "object") return
          const entry = proposalWaitersRef.current.get(Number(rid))
          if (entry) {
            entry.resolve(data as Record<string, unknown>)
          }
          return
        }

        case "active_symbols": {
          const sid = sessionIdRef.current
          if (!sid) return
          void apiGetSnapshot(sid)
            .then((snap) => {
              if (snap.assets?.length) setAssets(snap.assets)
            })
            .catch(() => {})
          return
        }

        case "tick": {
          const symbol = msg.symbol as string | undefined
          if (!symbol || !data || typeof data !== "object") return
          const t = data as { time: number; price: number }
          const tickData: TickData = { time: t.time, price: Number(t.price) }
          tickSubscriptionsRef.current.get(symbol)?.forEach((cb) => cb(tickData))
          return
        }

        case "ohlc": {
          const symbol = msg.symbol as string | undefined
          const granularity = msg.granularity as number | undefined
          if (symbol === undefined || granularity === undefined || !data || typeof data !== "object")
            return
          const key = `${symbol}_${granularity}`
          const candleData: OHLCCandle = {
            time: (data as OHLCCandle).time,
            open: Number((data as OHLCCandle).open),
            high: Number((data as OHLCCandle).high),
            low: Number((data as OHLCCandle).low),
            close: Number((data as OHLCCandle).close),
          }
          candleSubscriptionsRef.current.get(key)?.forEach((cb) => cb(candleData))
          return
        }

        case "buy": {
          if (!data || typeof data !== "object") return
          const buy = data as Record<string, unknown>
          const result: BuyContractResult = {
            contract_id: Number(buy.contract_id),
            buy_price: Number(buy.buy_price),
            balance_after: Number(buy.balance_after),
            longcode: String(buy.longcode ?? ""),
          }
          buyResultCallbacksRef.current.forEach((cb) => cb(result))
          return
        }

        case "proposal_open_contract": {
          if (!data || typeof data !== "object") return
          const c = data as Record<string, unknown>
          const rawSt = c.status
          const stLower =
            typeof rawSt === "string" ? rawSt.toLowerCase() : String(rawSt ?? "")
          let st: ContractUpdate["status"]
          if (stLower === "won" || stLower === "lost" || stLower === "sold" || stLower === "open") {
            st = stLower
          } else if (stLower === "expired") {
            st = "sold"
          } else {
            st = "open"
          }
          const update: ContractUpdate = {
            contract_id: Number(c.contract_id),
            status: st,
            profit: Number(c.profit ?? 0),
            exit_tick: c.exit_tick !== undefined ? Number(c.exit_tick) : undefined,
            exit_tick_time:
              c.exit_tick_time !== undefined ? Number(c.exit_tick_time) : undefined,
          }
          contractUpdateCallbacksRef.current.forEach((cb) => cb(update))
          return
        }

        case "session_closed":
          setIsConnected(false)
          return

        case "deriv_error": {
          const m =
            data && typeof data === "object" && "message" in data
              ? String((data as { message: string }).message)
              : "Erro Deriv"
          const ridRaw =
            data && typeof data === "object" && "req_id" in data
              ? (data as { req_id?: unknown }).req_id
              : undefined
          if (ridRaw !== undefined && ridRaw !== null) {
            const rid = Number(ridRaw)
            const entry = proposalWaitersRef.current.get(rid)
            if (entry) {
              entry.fail(new Error(m))
            }
          }
          setError(m)
          return
        }

        case "error": {
          const m =
            data && typeof data === "object" && "message" in data
              ? String((data as { message: string }).message)
              : "Erro no stream"
          setError(m)
          return
        }

        default:
          return
      }
    }
  }, [])

  const sendStream = useCallback((payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload))
    }
  }, [])

  const requestProposal = useCallback(
    (params: Record<string, unknown>): Promise<Record<string, unknown>> => {
      return new Promise((resolve, reject) => {
        const reqId = tradingReqIdRef.current++
        const timer = setTimeout(() => {
          const e = proposalWaitersRef.current.get(reqId)
          if (e) {
            proposalWaitersRef.current.delete(reqId)
            e.fail(new Error("Tempo esgotado ao pedir proposta à Deriv"))
          }
        }, 25000)
        proposalWaitersRef.current.set(reqId, {
          resolve: (v) => {
            clearTimeout(timer)
            proposalWaitersRef.current.delete(reqId)
            resolve(v)
          },
          fail: (err) => {
            clearTimeout(timer)
            proposalWaitersRef.current.delete(reqId)
            reject(err)
          },
        })
        sendStream({ action: "send", payload: { proposal: 1, ...params, req_id: reqId } })
      })
    },
    [sendStream]
  )

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    const sid = sessionIdRef.current
    sessionIdRef.current = null
    if (sid) {
      void apiDeleteSession(sid).catch(() => {})
    }
    setIsConnected(false)
    setBalance(null)
    setAssets([])
    setTickets([])
    setAccounts([])
    tickSubscriptionsRef.current.clear()
    candleSubscriptionsRef.current.clear()
    const pendingProposals = [...proposalWaitersRef.current.values()]
    proposalWaitersRef.current.clear()
    pendingProposals.forEach((e) => e.fail(new Error("Sessão encerrada")))
  }, [])

  const connect = useCallback((token: string) => {
    void (async () => {
      setIsLoading(true)
      setError(null)

      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      let sessionId: string | null = null
      try {
        const created = await apiCreateSession(token.trim())
        sessionId = created.session_id
        sessionIdRef.current = sessionId

        const snap = await apiGetSnapshot(sessionId)
        if (snap.error) setError(snap.error)
        setBalance(
          snap.balance
            ? {
                balance: Number(snap.balance.balance),
                currency: snap.balance.currency,
                loginid: snap.balance.loginid,
              }
            : null
        )
        setAccounts(snap.accounts)
        setAssets(snap.assets)
        setTickets(snap.tickets)

        await new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(getDerivStreamWsUrl(sessionId!))
          wsRef.current = ws
          ws.onopen = () => resolve()
          ws.onerror = () =>
            reject(
              new Error(
                "Não foi possível abrir o stream. Confira se o backend Python está rodando (ex.: porta 8000)."
              )
            )
          ws.onmessage = (event) => {
            try {
              const parsed = JSON.parse(event.data as string) as Record<string, unknown>
              processStreamEventRef.current(parsed)
            } catch {
              /* ignore */
            }
          }
          ws.onclose = () => {
            setIsConnected(false)
            wsRef.current = null
          }
        })

        setIsConnected(true)

        // O 1º snapshot costuma ocorrer antes da Deriv responder active_symbols; re-sincroniza em background.
        const sidSync = sessionIdRef.current
        if (sidSync) {
          void (async () => {
            for (let i = 0; i < 20; i++) {
              try {
                const snap = await apiGetSnapshot(sidSync)
                if (snap.assets.length > 0) {
                  setAssets(snap.assets)
                  return
                }
              } catch (e) {
                if (isSessionNotFoundError(e)) {
                  disconnect()
                  setError(
                    "Sessão não encontrada no servidor (o backend pode ter reiniciado). Conecte novamente."
                  )
                  return
                }
              }
              await new Promise((r) => setTimeout(r, 100))
            }
          })()
        }
      } catch (e) {
        if (sessionId) {
          await apiDeleteSession(sessionId).catch(() => {})
        }
        sessionIdRef.current = null
        setIsConnected(false)
        setError(
          isSessionNotFoundError(e)
            ? "Sessão não encontrada no servidor (o backend pode ter reiniciado). Conecte novamente."
            : e instanceof Error
              ? e.message
              : "Falha ao conectar."
        )
      } finally {
        setIsLoading(false)
      }
    })()
  }, [disconnect])

  const refreshData = useCallback(() => {
    const sid = sessionIdRef.current
    if (!sid || !isConnected) return
    void (async () => {
      try {
        await apiRefresh(sid)
        const snap = await apiGetSnapshot(sid)
        if (snap.balance) {
          setBalance({
            balance: Number(snap.balance.balance),
            currency: snap.balance.currency,
            loginid: snap.balance.loginid,
          })
        }
        setTickets(snap.tickets)
      } catch (e) {
        if (isSessionNotFoundError(e)) {
          disconnect()
          setError(
            "Sessão não encontrada no servidor (o backend pode ter reiniciado). Conecte novamente."
          )
        }
      }
    })()
  }, [isConnected, disconnect])

  const sendRequest = useCallback(
    (request: object) => {
      const sid = sessionIdRef.current
      if (!sid) return
      void apiSendPayload(sid, request).catch((e) => {
        if (isSessionNotFoundError(e)) {
          disconnect()
          setError(
            "Sessão não encontrada no servidor (o backend pode ter reiniciado). Conecte novamente."
          )
          return
        }
        setError(e instanceof Error ? e.message : "Falha ao enviar pedido.")
      })
    },
    [disconnect]
  )

  const subscribeToTicks = useCallback(
    (symbol: string, callback: (tick: TickData) => void) => {
      if (!tickSubscriptionsRef.current.has(symbol)) {
        tickSubscriptionsRef.current.set(symbol, new Set())
      }
      const set = tickSubscriptionsRef.current.get(symbol)!
      const first = set.size === 0
      set.add(callback)
      if (first) {
        sendStream({ action: "subscribe_ticks", symbol })
      }

      return () => {
        const cbs = tickSubscriptionsRef.current.get(symbol)
        if (!cbs) return
        cbs.delete(callback)
        if (cbs.size === 0) {
          tickSubscriptionsRef.current.delete(symbol)
          sendStream({ action: "unsubscribe_ticks", symbol })
        }
      }
    },
    [sendStream]
  )

  const subscribeToCandles = useCallback(
    (symbol: string, granularity: number, callback: (candle: OHLCCandle) => void) => {
      const key = `${symbol}_${granularity}`
      if (!candleSubscriptionsRef.current.has(key)) {
        candleSubscriptionsRef.current.set(key, new Set())
      }
      const set = candleSubscriptionsRef.current.get(key)!
      const first = set.size === 0
      set.add(callback)
      if (first) {
        sendStream({ action: "subscribe_candles", symbol, granularity })
      }

      return () => {
        const cbs = candleSubscriptionsRef.current.get(key)
        if (!cbs) return
        cbs.delete(callback)
        if (cbs.size === 0) {
          candleSubscriptionsRef.current.delete(key)
          sendStream({ action: "unsubscribe_candles", symbol, granularity })
        }
      }
    },
    [sendStream]
  )

  const getTicksHistory = useCallback(
    async (
      symbol: string,
      count: number,
      granularity?: number,
      subscribe?: boolean
    ): Promise<OHLCCandle[] | TickData[]> => {
      const sid = sessionIdRef.current
      if (!sid) {
        throw new Error("Sem sessão no servidor")
      }
      try {
        const res = await apiTicksHistory(sid, {
          symbol,
          count,
          granularity,
          subscribe: subscribe ?? false,
        })
        if (res.style === "candles" && "candles" in res) {
          return res.candles.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        }
        if (res.style === "ticks" && "ticks" in res) {
          return res.ticks.map((t) => ({ time: t.time, price: t.price }))
        }
        return []
      } catch (e) {
        if (isSessionNotFoundError(e)) {
          disconnect()
          setError(
            "Sessão não encontrada no servidor (o backend pode ter reiniciado). Conecte novamente."
          )
        }
        throw e
      }
    },
    [disconnect]
  )

  const onBuyResult = useCallback((callback: (result: BuyContractResult) => void) => {
    buyResultCallbacksRef.current.add(callback)
    return () => {
      buyResultCallbacksRef.current.delete(callback)
    }
  }, [])

  const onContractUpdate = useCallback((callback: (update: ContractUpdate) => void) => {
    contractUpdateCallbacksRef.current.add(callback)
    return () => {
      contractUpdateCallbacksRef.current.delete(callback)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      const sid = sessionIdRef.current
      sessionIdRef.current = null
      if (sid) {
        void apiDeleteSession(sid).catch(() => {})
      }
    }
  }, [])

  return (
    <DerivContext.Provider
      value={{
        isConnected,
        isLoading,
        error,
        balance,
        assets,
        tickets,
        accounts,
        connect,
        disconnect,
        refreshData,
        sendRequest,
        subscribeToTicks,
        subscribeToCandles,
        getTicksHistory,
        onBuyResult,
        onContractUpdate,
        requestProposal,
      }}
    >
      {children}
    </DerivContext.Provider>
  )
}
