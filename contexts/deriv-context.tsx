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
    granularity?: number
  ) => Promise<OHLCCandle[] | TickData[]>
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
  const tokenRef = useRef<string | null>(null)
  const tickSubscriptionsRef = useRef<Map<string, Set<(tick: TickData) => void>>>(new Map())
  const candleSubscriptionsRef = useRef<Map<string, Set<(candle: OHLCCandle) => void>>>(new Map())
  const subscriptionIdsRef = useRef<Map<string, string>>(new Map()) // key -> subscription_id
  const pendingRequestsRef = useRef<Map<string, (data: any) => void>>(new Map())
  const reqIdRef = useRef(1)

  const sendRequest = useCallback((request: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(request))
    }
  }, [])

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        
        // Log important messages for debugging
        if (["ohlc", "tick", "candles", "history"].includes(data.msg_type)) {
          console.log("[v0] WS Message:", data.msg_type, JSON.stringify(data).slice(0, 200))
        }

        if (data.error) {
          console.log("[v0] WS Error:", data.error.message)
          setError(data.error.message)
          // Check for pending request
          if (data.req_id && pendingRequestsRef.current.has(data.req_id.toString())) {
            pendingRequestsRef.current.delete(data.req_id.toString())
          }
          return
        }

        // Handle pending requests (for history) - but DON'T return, continue processing
        if (data.req_id && pendingRequestsRef.current.has(data.req_id.toString())) {
          const callback = pendingRequestsRef.current.get(data.req_id.toString())!
          callback(data)
          pendingRequestsRef.current.delete(data.req_id.toString())
          // Don't return - continue to process msg_type for subscriptions
        }

        switch (data.msg_type) {
          case "authorize":
            if (data.authorize) {
              setIsConnected(true)
              setError(null)
              setBalance({
                balance: data.authorize.balance,
                currency: data.authorize.currency,
                loginid: data.authorize.loginid,
              })
              setAccounts(data.authorize.account_list || [])
              sendRequest({ portfolio: 1 })
              sendRequest({ active_symbols: "brief", product_type: "basic" })
              sendRequest({ balance: 1, subscribe: 1 })
            }
            break

          case "balance":
            if (data.balance) {
              setBalance((prev) => ({
                ...prev!,
                balance: data.balance.balance,
                currency: data.balance.currency,
              }))
            }
            break

          case "active_symbols":
            if (data.active_symbols) {
              setAssets(
                data.active_symbols.map((symbol: any) => ({
                  symbol: symbol.symbol,
                  display_name: symbol.display_name,
                  market: symbol.market,
                  market_display_name: symbol.market_display_name,
                  submarket: symbol.submarket,
                  submarket_display_name: symbol.submarket_display_name,
                }))
              )
            }
            break

          case "portfolio":
            if (data.portfolio?.contracts) {
              setTickets(
                data.portfolio.contracts.map((contract: any) => ({
                  contract_id: contract.contract_id,
                  contract_type: contract.contract_type,
                  currency: contract.currency,
                  buy_price: contract.buy_price,
                  sell_price: contract.sell_price || 0,
                  profit: contract.profit || 0,
                  profit_percentage: contract.profit_percentage || 0,
                  payout: contract.payout,
                  purchase_time: contract.purchase_time,
                  expiry_time: contract.expiry_time,
                  underlying: contract.underlying,
                  underlying_display_name: contract.symbol || contract.underlying,
                  status: "open",
                  longcode: contract.longcode,
                }))
              )
            }
            break

          case "tick":
            if (data.tick) {
              const symbol = data.tick.symbol
              // Store subscription id
              if (data.subscription?.id) {
                subscriptionIdsRef.current.set(`tick_${symbol}`, data.subscription.id)
              }
              const tickData: TickData = {
                time: data.tick.epoch,
                price: data.tick.quote,
              }
              console.log("[v0] Tick received:", symbol, tickData.price)
              const callbacks = tickSubscriptionsRef.current.get(symbol)
              console.log("[v0] Tick callbacks count:", callbacks?.size || 0)
              if (callbacks) {
                callbacks.forEach((cb) => cb(tickData))
              }
            }
            break

          case "candles":
          case "history":
            // This is the initial response with subscription
            console.log("[v0] History/Candles received, subscription:", data.subscription?.id)
            if (data.subscription?.id && data.echo_req?.ticks_history) {
              const symbol = data.echo_req.ticks_history
              const granularity = data.echo_req.granularity || 60
              subscriptionIdsRef.current.set(`candle_${symbol}_${granularity}`, data.subscription.id)
              console.log("[v0] Stored subscription id:", data.subscription.id, "for", `candle_${symbol}_${granularity}`)
            }
            break
            
          case "ohlc":
            if (data.ohlc) {
              const symbol = data.ohlc.symbol
              const granularity = data.ohlc.granularity
              // Store subscription id
              if (data.subscription?.id) {
                subscriptionIdsRef.current.set(`candle_${symbol}_${granularity}`, data.subscription.id)
              }
              const candleData: OHLCCandle = {
                time: data.ohlc.open_time,
                open: parseFloat(data.ohlc.open),
                high: parseFloat(data.ohlc.high),
                low: parseFloat(data.ohlc.low),
                close: parseFloat(data.ohlc.close),
              }
              const key = `${symbol}_${granularity}`
              console.log("[v0] OHLC received:", key, "close:", candleData.close, "time:", candleData.time)
              console.log("[v0] Available keys:", Array.from(candleSubscriptionsRef.current.keys()))
              const callbacks = candleSubscriptionsRef.current.get(key)
              console.log("[v0] OHLC callbacks for key", key, "count:", callbacks?.size || 0)
              if (callbacks) {
                callbacks.forEach((cb) => cb(candleData))
              }
            }
            break
        }
      } catch (err) {
        console.error("Error parsing message:", err)
      }
    },
    [sendRequest]
  )

  const connect = useCallback(
    (token: string) => {
      setIsLoading(true)
      setError(null)
      tokenRef.current = token

      try {
        if (wsRef.current) {
          wsRef.current.close()
        }

        const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")
        wsRef.current = ws

        ws.onopen = () => {
          ws.send(JSON.stringify({ authorize: token }))
        }

        ws.onmessage = handleMessage

        ws.onerror = () => {
          setError("Erro de conexão. Verifique sua conexão com a internet.")
          setIsLoading(false)
        }

        ws.onclose = () => {
          setIsConnected(false)
          setIsLoading(false)
        }
      } catch (err) {
        setError("Falha ao conectar. Tente novamente.")
        setIsLoading(false)
      }
    },
    [handleMessage]
  )

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    tokenRef.current = null
    setIsConnected(false)
    setBalance(null)
    setAssets([])
    setTickets([])
    setAccounts([])
    tickSubscriptionsRef.current.clear()
    candleSubscriptionsRef.current.clear()
  }, [])

  const refreshData = useCallback(() => {
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      sendRequest({ portfolio: 1 })
      sendRequest({ balance: 1 })
    }
  }, [isConnected, sendRequest])

  const subscribeToTicks = useCallback(
    (symbol: string, callback: (tick: TickData) => void) => {
      // Always set up callback first
      if (!tickSubscriptionsRef.current.has(symbol)) {
        tickSubscriptionsRef.current.set(symbol, new Set())
      }
      tickSubscriptionsRef.current.get(symbol)!.add(callback)
      
      // Always send subscription request - the server will ignore duplicates
      console.log("[v0] Sending ticks subscription request for:", symbol)
      sendRequest({ ticks: symbol, subscribe: 1 })
      
      console.log("[v0] Added tick callback, total:", tickSubscriptionsRef.current.get(symbol)!.size)

      return () => {
        const callbacks = tickSubscriptionsRef.current.get(symbol)
        if (callbacks) {
          callbacks.delete(callback)
          console.log("[v0] Removed tick callback, remaining:", callbacks.size)
          // Only unsubscribe if no more callbacks
          if (callbacks.size === 0) {
            const subId = subscriptionIdsRef.current.get(`tick_${symbol}`)
            if (subId) {
              console.log("[v0] Forgetting tick subscription:", subId)
              sendRequest({ forget: subId })
              subscriptionIdsRef.current.delete(`tick_${symbol}`)
            }
            tickSubscriptionsRef.current.delete(symbol)
          }
        }
      }
    },
    [sendRequest]
  )

  const subscribeToCandles = useCallback(
    (symbol: string, granularity: number, callback: (candle: OHLCCandle) => void) => {
      const key = `${symbol}_${granularity}`
      
      // Always set up callback first
      if (!candleSubscriptionsRef.current.has(key)) {
        candleSubscriptionsRef.current.set(key, new Set())
      }
      candleSubscriptionsRef.current.get(key)!.add(callback)
      
      // Always send subscription request - the server will ignore duplicates
      console.log("[v0] Sending candles subscription request for:", key)
      sendRequest({
        ticks_history: symbol,
        style: "candles",
        granularity,
        count: 1,
        subscribe: 1,
      })
      
      console.log("[v0] Added candle callback, total:", candleSubscriptionsRef.current.get(key)!.size)

      return () => {
        const callbacks = candleSubscriptionsRef.current.get(key)
        if (callbacks) {
          callbacks.delete(callback)
          console.log("[v0] Removed candle callback, remaining:", callbacks.size)
          // Only unsubscribe if no more callbacks
          if (callbacks.size === 0) {
            const subId = subscriptionIdsRef.current.get(`candle_${symbol}_${granularity}`)
            if (subId) {
              console.log("[v0] Forgetting candle subscription:", subId)
              sendRequest({ forget: subId })
              subscriptionIdsRef.current.delete(`candle_${symbol}_${granularity}`)
            }
            candleSubscriptionsRef.current.delete(key)
          }
        }
      }
    },
    [sendRequest]
  )

  const getTicksHistory = useCallback(
    (
      symbol: string,
      count: number,
      granularity?: number,
      subscribe?: boolean
    ): Promise<OHLCCandle[] | TickData[]> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket not connected"))
          return
        }

        const reqId = reqIdRef.current++
        const request: Record<string, unknown> = {
          ticks_history: symbol,
          count,
          end: "latest",
          req_id: reqId,
        }

        if (granularity) {
          request.style = "candles"
          request.granularity = granularity
        } else {
          request.style = "ticks"
        }
        
        // Add subscribe flag to get real-time updates
        if (subscribe) {
          request.subscribe = 1
        }

        pendingRequestsRef.current.set(reqId.toString(), (data) => {
          if (data.error) {
            reject(new Error(data.error.message))
            return
          }
          
          // Store subscription ID for later cleanup
          if (data.subscription?.id) {
            if (granularity) {
              subscriptionIdsRef.current.set(`candle_${symbol}_${granularity}`, data.subscription.id)
              console.log("[v0] Stored candle subscription:", data.subscription.id)
            } else {
              subscriptionIdsRef.current.set(`tick_${symbol}`, data.subscription.id)
              console.log("[v0] Stored tick subscription:", data.subscription.id)
            }
          }

          if (data.candles) {
            const candles: OHLCCandle[] = data.candles.map((c: any) => ({
              time: c.epoch,
              open: parseFloat(c.open),
              high: parseFloat(c.high),
              low: parseFloat(c.low),
              close: parseFloat(c.close),
            }))
            resolve(candles)
          } else if (data.history) {
            const ticks: TickData[] = data.history.times.map((t: number, i: number) => ({
              time: t,
              price: parseFloat(data.history.prices[i]),
            }))
            resolve(ticks)
          } else {
            resolve([])
          }
        })

        wsRef.current.send(JSON.stringify(request))

        // Timeout after 10 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has(reqId.toString())) {
            pendingRequestsRef.current.delete(reqId.toString())
            reject(new Error("Request timeout"))
          }
        }, 10000)
      })
    },
    []
  )

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (isConnected) {
      setIsLoading(false)
    }
  }, [isConnected])

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
      }}
    >
      {children}
    </DerivContext.Provider>
  )
}
