"use client"

import { useState, useEffect, useCallback, useRef } from "react"

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

interface UseDerivReturn {
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
}

export function useDeriv(): UseDerivReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<DerivBalance | null>(null)
  const [assets, setAssets] = useState<DerivAsset[]>([])
  const [tickets, setTickets] = useState<DerivTicket[]>([])
  const [accounts, setAccounts] = useState<DerivAccount[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const tokenRef = useRef<string | null>(null)

  const sendRequest = useCallback((request: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(request))
    }
  }, [])

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      if (data.error) {
        setError(data.error.message)
        return
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
            // Request portfolio
            sendRequest({ portfolio: 1 })
            // Request active symbols
            sendRequest({ active_symbols: "brief", product_type: "basic" })
            // Subscribe to balance
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

        case "proposal_open_contract":
          // Update specific contract
          break
      }
    } catch (err) {
      console.error("Error parsing message:", err)
    }
  }, [sendRequest])

  const connect = useCallback((token: string) => {
    setIsLoading(true)
    setError(null)
    tokenRef.current = token

    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close()
      }

      const ws = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089")
      wsRef.current = ws

      ws.onopen = () => {
        // Authorize with token
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
  }, [handleMessage])

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
  }, [])

  const refreshData = useCallback(() => {
    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      sendRequest({ portfolio: 1 })
      sendRequest({ balance: 1 })
    }
  }, [isConnected, sendRequest])

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

  return {
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
  }
}
