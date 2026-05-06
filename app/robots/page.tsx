"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { flushSync } from "react-dom"
import Link from "next/link"
import { useDerivContext, type BuyContractResult, type ContractUpdate } from "@/contexts/deriv-context"
import { useRobotLogs } from "@/contexts/robot-logs-context"
import { RobotCard } from "@/components/deriv/robot-card"
import { RobotConfigModal } from "@/components/deriv/robot-config-modal"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Bot,
  Brain,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Target,
  AlertTriangle,
  Square,
  MonitorPlay,
  Zap,
  ExternalLink,
  type LucideIcon,
} from "lucide-react"
import { apiAnalyzeTeste } from "@/lib/deriv-api"
import {
  type OhlcBar,
  describeReversalEfraimDebug,
  REVERSAL_HUNTER_ID,
  signalReversalValueChartEfraim,
  signalTrendFollower,
} from "@/lib/robot-strategies"

export interface RobotStrategy {
  id: string
  name: string
  description: string
  type: "trend" | "reversal" | "martingale" | "scalping" | "grid" | "teste"
  icon: LucideIcon
  color: string
}

export interface RobotConfig {
  stake: number
  martingale: number
  maxMartingale: number
  stopLoss: number
  stopGain: number
  virtualLoss: boolean
  virtualLossLimit: number
  asset: string
  duration: number
  durationType: "t" | "m" | "h"
}

export interface RobotState {
  isRunning: boolean
  totalEntries: number
  wins: number
  losses: number
  currentBalance: number
  initialBalance: number
  profit: number
  currentMartingaleLevel: number
  virtualLossCount: number
  operations: Operation[]
  lastOperation?: Operation
  pendingContractId?: number
}

export interface Operation {
  id: string
  time: Date
  type: "CALL" | "PUT"
  entry: number
  exit?: number
  stake: number
  result?: "win" | "loss" | "pending"
  profit?: number
  martingaleLevel: number
  duration: number
  contractId?: number
}

export type OperationMode = "demo" | "real"

export const TESTE_ROBOT_ID = "teste"

const strategies: RobotStrategy[] = [
  {
    id: "trend-follower",
    name: "Seguidor de Tendencia",
    description:
      "Deterministico: EMA12/EMA26 + confirmacao EMA3/EMA7 no TF da configuracao",
    type: "trend",
    icon: TrendingUp,
    color: "text-primary",
  },
  {
    id: "reversal-hunter",
    name: "Cacador de Reversao",
    description:
      "Deterministico: ValueChart Efraim (len 14); entrada na linha ±8 (vhigh/vlow) no TF da config",
    type: "reversal",
    icon: TrendingDown,
    color: "text-chart-2",
  },
  {
    id: "smart-martingale",
    name: "Martingale Inteligente",
    description: "Mesma logica de tendencia (EMA12/26 + EMA3/7); gale ate max, depois repete ultimo gale",
    type: "martingale",
    icon: Target,
    color: "text-chart-3",
  },
  {
    id: "quick-scalper",
    name: "Scalper Rapido",
    description: "Mesma logica de tendencia (EMA12/26 + EMA3/7) no TF configurado",
    type: "scalping",
    icon: Activity,
    color: "text-chart-5",
  },
  {
    id: "grid-master",
    name: "Grid Master",
    description: "Mesma logica de tendencia (EMA12/26 + EMA3/7) no TF configurado",
    type: "grid",
    icon: Bot,
    color: "text-chart-4",
  },
  {
    id: TESTE_ROBOT_ID,
    name: "Teste",
    description:
      "Backend Python: RSI, MACD, momentum, tendência, probabilidades e tickets — velas no timeframe da sua duração",
    type: "teste",
    icon: Brain,
    color: "text-violet-500",
  },
]

const defaultConfig: RobotConfig = {
  stake: 1,
  martingale: 2,
  maxMartingale: 3,
  stopLoss: 50,
  stopGain: 100,
  virtualLoss: false,
  virtualLossLimit: 3,
  asset: "R_100",
  duration: 5,
  durationType: "m",
}

const PENDING_OPERATION_TIMEOUT_MS = 120_000
const TICK_LOG_INTERVAL_MS = 3_000
const WAIT_PENDING_LOG_MS = 6_000
/** Menos logs de P&L flutuante = menos re-renders nos cards (cada log atualiza o contexto). */
const OPEN_CONTRACT_LOG_INTERVAL_MS = 2_500

function normContractId(id: number | string | undefined | null): number {
  const n = Number(id)
  return Number.isFinite(n) ? n : 0
}

const TESTE_ANALYSIS_INTERVAL_MS = 14_000
const TESTE_MIN_CONFIDENCE = 0.52
/** Intervalo entre analises tecnicas locais (tendencia / reversao). */
const TECH_ANALYSIS_INTERVAL_MS = 8_000

/** Granularidade das velas pedidas à Deriv (segundos), alinhada à duração configurada no robô. */
function chartGranularitySeconds(config: RobotConfig): number {
  if (config.durationType === "h") return Math.max(300, config.duration * 3600)
  if (config.durationType === "m") return Math.max(60, config.duration * 60)
  return 60
}

function tradeDurationLabel(config: RobotConfig): string {
  const u = config.durationType === "m" ? "m" : config.durationType === "h" ? "h" : "t"
  return `${config.duration}${u}`
}

function ticksToCandles(
  ticks: Array<{ time: number; price: number }>,
  bucketSec: number
): Array<{ time: number; open: number; high: number; low: number; close: number }> {
  const bucketMs = Math.max(60, bucketSec)
  const map = new Map<
    number,
    { o: number; h: number; l: number; c: number; t: number }
  >()
  for (const tk of ticks) {
    const bucket = Math.floor(tk.time / bucketMs) * bucketMs
    const ex = map.get(bucket)
    if (!ex) {
      map.set(bucket, {
        o: tk.price,
        h: tk.price,
        l: tk.price,
        c: tk.price,
        t: bucket,
      })
    } else {
      ex.h = Math.max(ex.h, tk.price)
      ex.l = Math.min(ex.l, tk.price)
      ex.c = tk.price
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => ({
      time: v.t,
      open: v.o,
      high: v.h,
      low: v.l,
      close: v.c,
    }))
}

function closesFromHistory(
  hist: Array<{ time: number; open?: number; high?: number; low?: number; close?: number; price?: number }>,
  gran: number
): number[] {
  return ohlcFromHistory(hist, gran).map((c) => c.close)
}

function ohlcFromHistory(
  hist: Array<{ time: number; open?: number; high?: number; low?: number; close?: number; price?: number }>,
  gran: number
): OhlcBar[] {
  if (hist.length === 0) return []
  const h0 = hist[0]
  if (typeof h0.open === "number" && typeof h0.close === "number") {
    return (hist as Array<{ open: number; high: number; low: number; close: number }>).map((c) => ({
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
    }))
  }
  if (typeof h0.price === "number") {
    return ticksToCandles(hist as Array<{ time: number; price: number }>, gran).map((c) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
  }
  return []
}

function buildProposalDuration(config: RobotConfig) {
  let durationSeconds = config.duration
  if (config.durationType === "m") durationSeconds = config.duration * 60
  else if (config.durationType === "h") durationSeconds = config.duration * 3600

  let durationUnit = "s"
  let duration = durationSeconds
  if (durationSeconds >= 60 && durationSeconds < 3600) {
    durationUnit = "m"
    duration = Math.floor(durationSeconds / 60)
  } else if (durationSeconds >= 3600) {
    durationUnit = "h"
    duration = Math.floor(durationSeconds / 3600)
  } else if (durationSeconds < 60) {
    durationUnit = "t"
    duration = Math.max(5, durationSeconds)
  }
  return { duration, duration_unit: durationUnit }
}

export default function RobotsPage() {
  const {
    balance,
    assets,
    tickets,
    sendRequest,
    subscribeToTicks,
    isConnected,
    onBuyResult,
    onContractUpdate,
    requestProposal,
    getTicksHistory,
    refreshData,
  } = useDerivContext()
  const { log: pushLog } = useRobotLogs()
  const pushLogRef = useRef(pushLog)
  pushLogRef.current = pushLog

  const lastTickLogRef = useRef<Record<string, number>>({})
  const lastWaitPendingLogRef = useRef<Record<string, number>>({})
  const lastOpenContractLogRef = useRef<Map<number, number>>(new Map())

  const [robotStates, setRobotStates] = useState<Record<string, RobotState>>(() => {
    const initial: Record<string, RobotState> = {}
    strategies.forEach((strategy) => {
      initial[strategy.id] = {
        isRunning: false,
        totalEntries: 0,
        wins: 0,
        losses: 0,
        currentBalance: 10000,
        initialBalance: 10000,
        profit: 0,
        currentMartingaleLevel: 0,
        virtualLossCount: 0,
        operations: [],
      }
    })
    return initial
  })
  const [robotConfigs, setRobotConfigs] = useState<Record<string, RobotConfig>>(() => {
    const initial: Record<string, RobotConfig> = {}
    strategies.forEach((strategy) => {
      initial[strategy.id] = { ...defaultConfig }
    })
    return initial
  })
  const robotConfigsRef = useRef(robotConfigs)
  robotConfigsRef.current = robotConfigs

  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null)
  const [operationMode, setOperationMode] = useState<OperationMode>("demo")
  const tickUnsubscribeRef = useRef<Record<string, () => void>>({})
  const pendingContractsRef = useRef<Map<number, { robotId: string; operationId: string }>>(new Map())
  const pendingBuyQueueRef = useRef<Array<{ robotId: string; operationId: string }>>([])
  /** Metadados síncronos da operação — o buy da Deriv pode chegar antes do setState que a adiciona. */
  const pendingOpDetailsRef = useRef<Map<string, { robotId: string; operation: Operation }>>(new Map())
  const processSignalRef = useRef<(robotId: string, price: number, time: number) => void>(() => {})
  /** Evita nova entrada antes da anterior fechar (ticks/WebSocket não fazem batch com o React). */
  const tradeInFlightRef = useRef<Record<string, boolean>>({})
  const getTicksHistoryRef = useRef(getTicksHistory)
  getTicksHistoryRef.current = getTicksHistory
  const ticketsRef = useRef(tickets)
  ticketsRef.current = tickets
  const refreshDataRef = useRef(refreshData)
  refreshDataRef.current = refreshData
  const lastTesteAnalysisRef = useRef<Record<string, number>>({})
  const testeAnalysisBusyRef = useRef<Record<string, boolean>>({})
  const lastTechAnalysisRef = useRef<Record<string, number>>({})
  const techAnalysisBusyRef = useRef<Record<string, boolean>>({})
  const queueRobotTradeRef = useRef<
    (robotId: string, signal: "CALL" | "PUT", price: number, detail: string) => void
  >(() => {})

  // Calculate overall stats
  const overallStats = {
    totalEntries: Object.values(robotStates).reduce((acc, s) => acc + s.totalEntries, 0),
    totalWins: Object.values(robotStates).reduce((acc, s) => acc + s.wins, 0),
    totalLosses: Object.values(robotStates).reduce((acc, s) => acc + s.losses, 0),
    totalProfit: Object.values(robotStates).reduce((acc, s) => acc + s.profit, 0),
    activeRobots: Object.values(robotStates).filter((s) => s.isRunning).length,
  }

  const closedTrades = overallStats.totalWins + overallStats.totalLosses
  const winRate =
    closedTrades > 0
      ? ((overallStats.totalWins / closedTrades) * 100).toFixed(1)
      : "0.0"

  const openConfigModal = (robotId: string) => {
    setSelectedRobot(robotId)
    setConfigModalOpen(true)
  }

  const saveConfig = (config: RobotConfig) => {
    if (selectedRobot) {
      setRobotConfigs((prev) => ({
        ...prev,
        [selectedRobot]: config,
      }))
    }
    setConfigModalOpen(false)
    setSelectedRobot(null)
  }

  const executeDerivOrder = useCallback(
    async (
      robotId: string,
      operationId: string,
      signal: "CALL" | "PUT",
      stake: number,
      config: RobotConfig
    ) => {
      const currency = balance?.currency || "USD"
      const { duration, duration_unit } = buildProposalDuration(config)
      pushLogRef.current({
        robotId,
        level: "info",
        message: `Pedindo proposta: ${signal} ${config.asset} stake=${stake} ${currency} dur=${duration} ${duration_unit}`,
      })
      try {
        const proposal = await requestProposal({
          amount: stake,
          basis: "stake",
          contract_type: signal === "CALL" ? "CALL" : "PUT",
          currency,
          symbol: config.asset,
          duration,
          duration_unit,
        })
        pushLogRef.current({
          robotId,
          level: "info",
          message: "Proposta OK",
          detail: JSON.stringify(proposal, null, 2).slice(0, 2000),
        })
        const proposalId = proposal.id as string | number | undefined
        if (proposalId === undefined || proposalId === null) {
          throw new Error("Resposta da Deriv sem id de proposta")
        }
        const askPrice = Number(proposal.ask_price ?? proposal.payout ?? stake)
        const price = Number.isFinite(askPrice) ? askPrice : stake
        pendingBuyQueueRef.current.push({ robotId, operationId })
        pushLogRef.current({
          robotId,
          level: "info",
          message: `Enviando buy: proposal_id=${proposalId} price=${price}`,
        })
        sendRequest({ buy: proposalId, price })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        pushLogRef.current({
          robotId,
          level: "error",
          message: `Falha proposal/buy: ${msg}`,
        })
        tradeInFlightRef.current[robotId] = false
        pendingOpDetailsRef.current.delete(operationId)
        setRobotStates((prev) => {
          const state = prev[robotId]
          if (!state) return prev
          return {
            ...prev,
            [robotId]: {
              ...state,
              totalEntries: Math.max(0, state.totalEntries - 1),
              operations: state.operations.filter((op) => op.id !== operationId),
            },
          }
        })
      }
    },
    [balance?.currency, requestProposal, sendRequest]
  )

  const queueRobotTrade = useCallback(
    (robotId: string, signal: "CALL" | "PUT", price: number, detail: string) => {
      setRobotStates((prev) => {
        const state = prev[robotId]
        const config = robotConfigsRef.current[robotId]
        if (!state?.isRunning || !config) return prev
        if (state.profit <= -config.stopLoss || state.profit >= config.stopGain) return prev
        if (state.operations.some((o) => o.result === "pending")) return prev
        if (tradeInFlightRef.current[robotId]) return prev

        const martingaleMultiplier = Math.pow(config.martingale, state.currentMartingaleLevel)
        const stake = config.stake * martingaleMultiplier
        const newOperation: Operation = {
          id: `${robotId}-${Date.now()}`,
          time: new Date(),
          type: signal,
          entry: price,
          stake,
          result: "pending",
          martingaleLevel: state.currentMartingaleLevel,
          duration: config.duration,
        }
        tradeInFlightRef.current[robotId] = true
        pendingOpDetailsRef.current.set(newOperation.id, { robotId, operation: newOperation })
        queueMicrotask(() => {
          pushLogRef.current({
            robotId,
            level: "info",
            message: `Ordem ${signal} @${price} stake=${stake} — ${detail}`,
          })
          void executeDerivOrder(robotId, newOperation.id, signal, stake, config)
        })
        return {
          ...prev,
          [robotId]: {
            ...state,
            totalEntries: state.totalEntries + 1,
            operations: [...state.operations.slice(-49), newOperation],
            lastOperation: newOperation,
          },
        }
      })
    },
    [executeDerivOrder]
  )

  useEffect(() => {
    queueRobotTradeRef.current = queueRobotTrade
  }, [queueRobotTrade])

  useEffect(() => {
    const unsubscribeBuy = onBuyResult((result: BuyContractResult) => {
      const q = pendingBuyQueueRef.current.shift()
      if (!q) {
        pushLogRef.current({
          level: "warn",
          message: `buy recebido sem fila pendente (contract_id=${result.contract_id}) — possível dessincronização`,
        })
        return
      }

      const contractId = normContractId(result.contract_id)

      pushLogRef.current({
        robotId: q.robotId,
        level: "info",
        message: `Compra confirmada contract_id=${contractId} buy_price=${result.buy_price}`,
        detail: result.longcode?.slice(0, 500),
      })

      const meta = pendingOpDetailsRef.current.get(q.operationId)

      pendingContractsRef.current.set(contractId, {
        robotId: q.robotId,
        operationId: q.operationId,
      })

      flushSync(() => {
        setRobotStates((prev) => {
          const state = prev[q.robotId]
          if (!state) return prev

          const hasOp = state.operations.some((op) => op.id === q.operationId)
          let operations: Operation[]
          let totalEntries = state.totalEntries

          if (!hasOp && meta) {
            operations = [...state.operations, { ...meta.operation, contractId }]
            totalEntries = state.totalEntries + 1
          } else if (hasOp) {
            operations = state.operations.map((op) =>
              op.id === q.operationId ? { ...op, contractId } : op
            )
          } else {
            pushLogRef.current({
              robotId: q.robotId,
              level: "warn",
              message: `Compra OK sem linha na UI nem meta — contract_id=${contractId}`,
            })
            operations = state.operations
          }

          const lastOp = operations[operations.length - 1]

          return {
            ...prev,
            [q.robotId]: {
              ...state,
              totalEntries,
              operations,
              lastOperation: lastOp,
            },
          }
        })
      })

      pendingOpDetailsRef.current.delete(q.operationId)
    })

    return () => {
      unsubscribeBuy()
    }
  }, [onBuyResult])

  useEffect(() => {
    const unsubscribeContract = onContractUpdate((update: ContractUpdate) => {
      const cid = normContractId(update.contract_id)
      const pendingInfo = pendingContractsRef.current.get(cid)
      if (!pendingInfo) {
        pushLogRef.current({
          level: "tick",
          message: `Atualização de contrato (não mapeada ao robô): ${cid} status=${update.status} profit=${update.profit}`,
        })
        return
      }

      if (update.status === "open") {
        const now = Date.now()
        const last = lastOpenContractLogRef.current.get(cid) ?? 0
        if (now - last >= OPEN_CONTRACT_LOG_INTERVAL_MS) {
          lastOpenContractLogRef.current.set(cid, now)
          pushLogRef.current({
            robotId: pendingInfo.robotId,
            level: "tick",
            message: `Contrato aberto ${cid} profit flutuante=${update.profit}`,
          })
        }
        return
      }

      // A Deriv costuma enviar "sold" no fecho (além de won/lost); antes ignorávamos e a UI ficava em Pendente.
      const isTerminal =
        update.status === "won" || update.status === "lost" || update.status === "sold"
      if (!isTerminal) return

      const isWin =
        update.status === "won"
          ? true
          : update.status === "lost"
            ? false
            : update.profit > 0

      tradeInFlightRef.current[pendingInfo.robotId] = false
      lastOpenContractLogRef.current.delete(cid)

      const profit = update.profit

      // 1) Atualiza operações antes do log (menos churn no contexto). 2) flushSync força pintura imediata.
      flushSync(() => {
        setRobotStates((prev) => {
          const state = prev[pendingInfo.robotId]
          if (!state) return prev

          const config = robotConfigsRef.current[pendingInfo.robotId]
          if (!config) return prev

          const matchesRow = (op: Operation) =>
            op.id === pendingInfo.operationId ||
            (op.contractId != null && normContractId(op.contractId) === cid)

          let hit = false
          const updatedOperations = state.operations.map((op) => {
            if (!matchesRow(op)) return op
            hit = true
            return {
              ...op,
              result: isWin ? "win" : ("loss" as const),
              profit,
            }
          })

          if (!hit) {
            queueMicrotask(() =>
              pushLogRef.current({
                robotId: pendingInfo.robotId,
                level: "warn",
                message: `Fecho ${cid} (${update.status}) sem linha em Operações (opId esperado=${pendingInfo.operationId}) — stats não atualizados`,
              })
            )
            return prev
          }

          pendingContractsRef.current.delete(cid)
          pendingOpDetailsRef.current.delete(pendingInfo.operationId)

          return {
            ...prev,
            [pendingInfo.robotId]: {
              ...state,
              wins: isWin ? state.wins + 1 : state.wins,
              losses: !isWin ? state.losses + 1 : state.losses,
              profit: state.profit + profit,
              currentMartingaleLevel: isWin
                ? 0
                : state.currentMartingaleLevel >= config.maxMartingale
                  ? config.maxMartingale
                  : state.currentMartingaleLevel + 1,
              operations: updatedOperations,
            },
          }
        })
      })

      pushLogRef.current({
        robotId: pendingInfo.robotId,
        level: "info",
        message: `Contrato finalizado: ${update.status}${update.status === "sold" ? " (fechado)" : ""} → ${isWin ? "ganhou" : "perdeu"} profit=${update.profit}`,
      })
    })

    return () => {
      unsubscribeContract()
    }
  }, [onContractUpdate])

  const startRobot = useCallback(
    (robotId: string) => {
      const config = robotConfigs[robotId]
      if (!config || !isConnected) return

      if (tickUnsubscribeRef.current[robotId]) {
        tickUnsubscribeRef.current[robotId]()
        delete tickUnsubscribeRef.current[robotId]
      }

      setRobotStates((prev) => {
        const cur = prev[robotId]
        if (!cur) return prev
        const pendingBroken = cur.operations.filter(
          (op) => op.result === "pending" && op.contractId == null
        )
        pendingBroken.forEach((op) => pendingOpDetailsRef.current.delete(op.id))
        const cleaned = cur.operations.filter(
          (op) => !(op.result === "pending" && op.contractId == null)
        )
        const dropped = pendingBroken.length
        if (dropped > 0) {
          tradeInFlightRef.current[robotId] = false
          queueMicrotask(() =>
            pushLogRef.current({
              robotId,
              level: "warn",
              message: `Removidas ${dropped} operação(ões) pendente(s) sem contract_id ao iniciar (evita bloquear novas entradas)`,
            })
          )
        }
        const stillPendingContract = cleaned.some(
          (op) => op.result === "pending" && op.contractId != null
        )
        tradeInFlightRef.current[robotId] = stillPendingContract
        return {
          ...prev,
          [robotId]: {
            ...cur,
            isRunning: true,
            initialBalance: balance?.balance ?? cur.initialBalance,
            currentBalance: balance?.balance ?? cur.currentBalance,
            operations: cleaned,
            totalEntries: Math.max(0, cur.totalEntries - dropped),
          },
        }
      })

      pushLogRef.current({
        robotId,
        level: "info",
        message: `Robô iniciado — ticks em ${config.asset}`,
      })

      const unsubscribe = subscribeToTicks(config.asset, (tick) => {
        const now = Date.now()
        const last = lastTickLogRef.current[robotId] || 0
        if (now - last >= TICK_LOG_INTERVAL_MS) {
          lastTickLogRef.current[robotId] = now
          pushLogRef.current({
            robotId,
            level: "tick",
            message: `Tick ${config.asset} price=${tick.price} t=${tick.time}`,
          })
        }
        processSignalRef.current(robotId, tick.price, tick.time)
      })

      tickUnsubscribeRef.current[robotId] = unsubscribe
    },
    [robotConfigs, isConnected, balance, subscribeToTicks]
  )

  const stopRobot = useCallback((robotId: string) => {
    tradeInFlightRef.current[robotId] = false
    testeAnalysisBusyRef.current[robotId] = false
    techAnalysisBusyRef.current[robotId] = false
    pendingBuyQueueRef.current = pendingBuyQueueRef.current.filter((x) => x.robotId !== robotId)
    setRobotStates((prev) => ({
      ...prev,
      [robotId]: {
        ...prev[robotId],
        isRunning: false,
      },
    }))

    // Unsubscribe from ticks
    if (tickUnsubscribeRef.current[robotId]) {
      tickUnsubscribeRef.current[robotId]()
      delete tickUnsubscribeRef.current[robotId]
    }
  }, [])

  const resetRobot = useCallback((robotId: string) => {
    tradeInFlightRef.current[robotId] = false
    testeAnalysisBusyRef.current[robotId] = false
    techAnalysisBusyRef.current[robotId] = false
    delete lastTesteAnalysisRef.current[robotId]
    delete lastTechAnalysisRef.current[robotId]
    for (const [opId, meta] of [...pendingOpDetailsRef.current.entries()]) {
      if (meta.robotId === robotId) pendingOpDetailsRef.current.delete(opId)
    }
    for (const [cid, info] of [...pendingContractsRef.current.entries()]) {
      if (info.robotId === robotId) pendingContractsRef.current.delete(cid)
    }
    pendingBuyQueueRef.current = pendingBuyQueueRef.current.filter((x) => x.robotId !== robotId)
    stopRobot(robotId)
    setRobotStates((prev) => ({
      ...prev,
      [robotId]: {
        isRunning: false,
        totalEntries: 0,
        wins: 0,
        losses: 0,
        currentBalance: balance?.balance || 10000,
        initialBalance: balance?.balance || 10000,
        profit: 0,
        currentMartingaleLevel: 0,
        virtualLossCount: 0,
        operations: [],
      },
    }))
  }, [stopRobot, balance?.balance])

  const stopAllRobots = () => {
    strategies.forEach((s) => stopRobot(s.id))
  }

  const processSignal = useCallback(
    (robotId: string, price: number, time: number) => {
      setRobotStates((prev) => {
        const state = prev[robotId]
        const config = robotConfigs[robotId]

        if (!state?.isRunning || !config) return prev

        if (state.profit <= -config.stopLoss || state.profit >= config.stopGain) {
          queueMicrotask(() => stopRobot(robotId))
          return {
            ...prev,
            [robotId]: { ...state, isRunning: false },
          }
        }

        const pendingOp = state.operations.find((op) => op.result === "pending")
        if (pendingOp) {
          const age = Date.now() - pendingOp.time.getTime()
          if (age > PENDING_OPERATION_TIMEOUT_MS) {
            tradeInFlightRef.current[robotId] = false
            pendingOpDetailsRef.current.delete(pendingOp.id)
            queueMicrotask(() =>
              pushLogRef.current({
                robotId,
                level: "warn",
                message: `Timeout ${PENDING_OPERATION_TIMEOUT_MS}ms em operação pendente ${pendingOp.id} — liberando fila`,
              })
            )
            return {
              ...prev,
              [robotId]: {
                ...state,
                totalEntries: Math.max(0, state.totalEntries - 1),
                operations: state.operations.filter((op) => op.id !== pendingOp.id),
              },
            }
          }
          const nw = Date.now()
          const lw = lastWaitPendingLogRef.current[robotId] || 0
          if (nw - lw >= WAIT_PENDING_LOG_MS) {
            lastWaitPendingLogRef.current[robotId] = nw
            queueMicrotask(() =>
              pushLogRef.current({
                robotId,
                level: "info",
                message: `Aguardando fechamento do contrato (op ${pendingOp.id} pendente há ${Math.round(age / 1000)}s, contractId=${pendingOp.contractId ?? "—"})`,
              })
            )
          }
          return prev
        }

        if (tradeInFlightRef.current[robotId]) {
          return prev
        }

        if (robotId === TESTE_ROBOT_ID) {
          const now = Date.now()
          if (now - (lastTesteAnalysisRef.current[robotId] ?? 0) < TESTE_ANALYSIS_INTERVAL_MS) {
            return prev
          }
          if (testeAnalysisBusyRef.current[robotId]) {
            return prev
          }
          testeAnalysisBusyRef.current[robotId] = true
          lastTesteAnalysisRef.current[robotId] = now
          const priceSnap = price
          queueMicrotask(() => {
            void (async () => {
              try {
                refreshDataRef.current()
                const config = robotConfigsRef.current[robotId]
                if (!config) return
                const gran = chartGranularitySeconds(config)
                const hist = await getTicksHistoryRef.current(config.asset, 150, gran, false)
                let candles: Array<{
                  time: number
                  open: number
                  high: number
                  low: number
                  close: number
                }> = []
                if (hist.length > 0) {
                  const h0 = hist[0] as { open?: number; price?: number }
                  if (typeof h0.open === "number") {
                    candles = (
                      hist as Array<{
                        time: number
                        open: number
                        high: number
                        low: number
                        close: number
                      }>
                    ).map((c) => ({
                      time: c.time,
                      open: Number(c.open),
                      high: Number(c.high),
                      low: Number(c.low),
                      close: Number(c.close),
                    }))
                  } else if (typeof h0.price === "number") {
                    candles = ticksToCandles(hist as Array<{ time: number; price: number }>, gran)
                  }
                }
                const ticketsPayload = ticketsRef.current.map((t) => ({
                  contract_id: t.contract_id,
                  underlying: t.underlying,
                  contract_type: t.contract_type,
                  profit: t.profit,
                  status: t.status,
                  buy_price: t.buy_price,
                  longcode: (t.longcode ?? "").slice(0, 240),
                }))
                const res = await apiAnalyzeTeste({
                  symbol: config.asset,
                  candles,
                  tickets: ticketsPayload,
                  chart_granularity_seconds: gran,
                  trade_duration_label: tradeDurationLabel(config),
                })
                pushLogRef.current({
                  robotId,
                  level: "info",
                  message: `Teste Python: ${res.signal} conf=${res.confidence} p_call=${res.probability_call} p_put=${res.probability_put}`,
                  detail: `${res.rationale}\n${JSON.stringify(res.indicators, null, 2).slice(0, 1800)}`,
                })
                if (res.signal === "HOLD" || res.confidence < TESTE_MIN_CONFIDENCE) {
                  return
                }
                queueRobotTradeRef.current(
                  robotId,
                  res.signal,
                  priceSnap,
                  res.rationale.slice(0, 220)
                )
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                pushLogRef.current({
                  robotId,
                  level: "error",
                  message: `Teste Python falhou: ${msg}`,
                })
              } finally {
                testeAnalysisBusyRef.current[robotId] = false
              }
            })()
          })
          return prev
        }

        const nowTech = Date.now()
        if (nowTech - (lastTechAnalysisRef.current[robotId] ?? 0) < TECH_ANALYSIS_INTERVAL_MS) {
          return prev
        }
        if (techAnalysisBusyRef.current[robotId]) {
          return prev
        }
        techAnalysisBusyRef.current[robotId] = true
        lastTechAnalysisRef.current[robotId] = nowTech
        const priceSnap = price
        const useReversal = robotId === REVERSAL_HUNTER_ID
        queueMicrotask(() => {
          void (async () => {
            try {
              refreshDataRef.current()
              const cfg = robotConfigsRef.current[robotId]
              if (!cfg) return
              const gran = chartGranularitySeconds(cfg)
              const hist = await getTicksHistoryRef.current(cfg.asset, 150, gran, false)
              const ohlc = ohlcFromHistory(hist, gran)
              const closes = ohlc.map((c) => c.close)
              const sig = useReversal
                ? signalReversalValueChartEfraim(ohlc)
                : signalTrendFollower(closes)
              const dbg = useReversal
                ? describeReversalEfraimDebug(ohlc)
                : `EMA12/26+3/7 tf=${gran}s fechos=${closes.length}`
              pushLogRef.current({
                robotId,
                level: "info",
                message: `${useReversal ? "Reversão" : "Tendência"}: ${sig} — ${dbg}`,
              })
              if (sig === "HOLD") return
              queueRobotTradeRef.current(robotId, sig, priceSnap, dbg.slice(0, 220))
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              pushLogRef.current({
                robotId,
                level: "error",
                message: `Análise técnica falhou: ${msg}`,
              })
            } finally {
              techAnalysisBusyRef.current[robotId] = false
            }
          })()
        })

        return prev
      })
    },
    [robotConfigs, stopRobot]
  )

  useEffect(() => {
    processSignalRef.current = processSignal
  }, [processSignal])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(tickUnsubscribeRef.current).forEach((unsub) => unsub())
    }
  }, [])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Robos de Trading
          </h1>
          <p className="text-sm text-muted-foreground">
            Execute multiplas estrategias simultaneamente
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/robots/logs" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Logs (nova aba)
            </Link>
          </Button>
          {/* Operation Mode Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border">
            <div className="flex items-center gap-2">
              <MonitorPlay className={`h-4 w-4 ${operationMode === "demo" ? "text-chart-3" : "text-muted-foreground"}`} />
              <Label 
                htmlFor="operation-mode" 
                className={`text-sm cursor-pointer ${operationMode === "demo" ? "text-chart-3 font-medium" : "text-muted-foreground"}`}
              >
                Demonstracao
              </Label>
            </div>
            <Switch
              id="operation-mode"
              checked={operationMode === "real"}
              onCheckedChange={(checked) => setOperationMode(checked ? "real" : "demo")}
              disabled={overallStats.activeRobots > 0}
            />
            <div className="flex items-center gap-2">
              <Label 
                htmlFor="operation-mode" 
                className={`text-sm cursor-pointer ${operationMode === "real" ? "text-primary font-medium" : "text-muted-foreground"}`}
              >
                Real
              </Label>
              <Zap className={`h-4 w-4 ${operationMode === "real" ? "text-primary" : "text-muted-foreground"}`} />
            </div>
          </div>

          <Badge variant={overallStats.activeRobots > 0 ? "default" : "secondary"}>
            {overallStats.activeRobots} Robos Ativos
          </Badge>
          {overallStats.activeRobots > 0 && (
            <Button variant="destructive" size="sm" onClick={stopAllRobots}>
              <Square className="h-4 w-4 mr-2" />
              Parar Todos
            </Button>
          )}
        </div>
      </div>

      {/* Mode Banner */}
      <Card className={`p-4 mb-6 ${operationMode === "real" ? "border-primary/50 bg-primary/5" : "border-chart-3/50 bg-chart-3/5"}`}>
        <div className="flex items-center gap-3">
          {operationMode === "real" ? (
            <>
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-primary">Modo real (alerta)</p>
                <p className="text-sm text-muted-foreground">
                  As ordens sao sempre enviadas à API Deriv na conta do token. Se o token for de conta real, o saldo real é usado. Confirme na Deriv antes de operar.
                </p>
              </div>
            </>
          ) : (
            <>
              <MonitorPlay className="h-5 w-5 text-chart-3" />
              <div>
                <p className="font-medium text-chart-3">Modo demonstração (rótulo)</p>
                <p className="text-sm text-muted-foreground">
                  Proposta + compra na Deriv igual ao modo real. Use com token de conta demo (saldo virtual) para praticar; o resultado vem dos contratos reais da corretora, não de sorteio local.
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Overall Stats */}
      <div className="grid gap-4 mb-6 grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Saldo Atual</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {balance?.currency || "USD"} {(balance?.balance || 0).toFixed(2)}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-chart-2" />
            <span className="text-xs text-muted-foreground">Total Entradas</span>
          </div>
          <p className="text-xl font-bold text-foreground">{overallStats.totalEntries}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Acertos</span>
          </div>
          <p className="text-xl font-bold text-primary">{overallStats.totalWins}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Erros</span>
          </div>
          <p className="text-xl font-bold text-destructive">{overallStats.totalLosses}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-chart-3" />
            <span className="text-xs text-muted-foreground">Win Rate</span>
          </div>
          <p className="text-xl font-bold text-chart-3">{winRate}%</p>
          {closedTrades > 0 ? (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {closedTrades} fechada(s) · entradas totais {overallStats.totalEntries}
            </p>
          ) : null}
        </Card>
      </div>

      {/* Profit/Loss Banner */}
      <Card
        className={`p-4 mb-6 ${
          overallStats.totalProfit >= 0 ? "border-primary/50 bg-primary/5" : "border-destructive/50 bg-destructive/5"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {overallStats.totalProfit >= 0 ? (
              <TrendingUp className="h-6 w-6 text-primary" />
            ) : (
              <TrendingDown className="h-6 w-6 text-destructive" />
            )}
            <div>
              <p className="text-sm text-muted-foreground">Lucro/Prejuizo Total</p>
              <p
                className={`text-2xl font-bold ${
                  overallStats.totalProfit >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {overallStats.totalProfit >= 0 ? "+" : ""}
                {balance?.currency || "USD"} {overallStats.totalProfit.toFixed(2)}
              </p>
            </div>
          </div>
          {overallStats.totalProfit < -50 && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Stop Loss Proximo</span>
            </div>
          )}
        </div>
      </Card>

      {/* Robot Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {strategies.map((strategy) => (
          <RobotCard
            key={strategy.id}
            strategy={strategy}
            config={robotConfigs[strategy.id] || defaultConfig}
            state={robotStates[strategy.id]}
            assets={assets}
            operationMode={operationMode}
            onStart={() => startRobot(strategy.id)}
            onStop={() => stopRobot(strategy.id)}
            onReset={() => resetRobot(strategy.id)}
            onConfigure={() => openConfigModal(strategy.id)}
          />
        ))}
      </div>

      {/* Config Modal */}
      <RobotConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
        config={selectedRobot ? robotConfigs[selectedRobot] : defaultConfig}
        onSave={saveConfig}
        assets={assets}
        strategyName={strategies.find((s) => s.id === selectedRobot)?.name || ""}
      />
    </div>
  )
}
