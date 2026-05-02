"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDerivContext, type BuyContractResult, type ContractUpdate } from "@/contexts/deriv-context"
import { RobotCard } from "@/components/deriv/robot-card"
import { RobotConfigModal } from "@/components/deriv/robot-config-modal"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Bot,
  TrendingUp,
  TrendingDown,
  Activity,
  Wallet,
  Target,
  AlertTriangle,
  Square,
  MonitorPlay,
  Zap,
} from "lucide-react"

export interface RobotStrategy {
  id: string
  name: string
  description: string
  type: "trend" | "reversal" | "martingale" | "scalping" | "grid"
  icon: typeof TrendingUp
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

const strategies: RobotStrategy[] = [
  {
    id: "trend-follower",
    name: "Seguidor de Tendencia",
    description: "Opera na direcao da tendencia usando medias moveis e momentum",
    type: "trend",
    icon: TrendingUp,
    color: "text-primary",
  },
  {
    id: "reversal-hunter",
    name: "Cacador de Reversao",
    description: "Identifica pontos de reversao usando RSI e suporte/resistencia",
    type: "reversal",
    icon: TrendingDown,
    color: "text-chart-2",
  },
  {
    id: "smart-martingale",
    name: "Martingale Inteligente",
    description: "Martingale com filtros de entrada para evitar sequencias ruins",
    type: "martingale",
    icon: Target,
    color: "text-chart-3",
  },
  {
    id: "quick-scalper",
    name: "Scalper Rapido",
    description: "Operacoes rapidas de 1-5 minutos em alta volatilidade",
    type: "scalping",
    icon: Activity,
    color: "text-chart-5",
  },
  {
    id: "grid-master",
    name: "Grid Master",
    description: "Estrategia de grid trading para mercados laterais",
    type: "grid",
    icon: Bot,
    color: "text-chart-4",
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

export default function RobotsPage() {
  const { balance, assets, sendRequest, subscribeToTicks, isConnected, onBuyResult, onContractUpdate } = useDerivContext()
  const [robotStates, setRobotStates] = useState<Record<string, RobotState>>({})
  const [robotConfigs, setRobotConfigs] = useState<Record<string, RobotConfig>>({})
  const [configModalOpen, setConfigModalOpen] = useState(false)
  const [selectedRobot, setSelectedRobot] = useState<string | null>(null)
  const [operationMode, setOperationMode] = useState<OperationMode>("demo")
  const tickUnsubscribeRef = useRef<Record<string, () => void>>({})
  const pendingContractsRef = useRef<Map<number, { robotId: string; operationId: string }>>(new Map())

  // Initialize robot states
  useEffect(() => {
    const initialStates: Record<string, RobotState> = {}
    const initialConfigs: Record<string, RobotConfig> = {}

    strategies.forEach((strategy) => {
      initialStates[strategy.id] = {
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
      }
      initialConfigs[strategy.id] = { ...defaultConfig }
    })

    setRobotStates(initialStates)
    setRobotConfigs(initialConfigs)
  }, [balance?.balance])

  // Calculate overall stats
  const overallStats = {
    totalEntries: Object.values(robotStates).reduce((acc, s) => acc + s.totalEntries, 0),
    totalWins: Object.values(robotStates).reduce((acc, s) => acc + s.wins, 0),
    totalLosses: Object.values(robotStates).reduce((acc, s) => acc + s.losses, 0),
    totalProfit: Object.values(robotStates).reduce((acc, s) => acc + s.profit, 0),
    activeRobots: Object.values(robotStates).filter((s) => s.isRunning).length,
  }

  const winRate = overallStats.totalEntries > 0
    ? ((overallStats.totalWins / overallStats.totalEntries) * 100).toFixed(1)
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

  // Buy contract on Deriv (real operation)
  const buyContract = useCallback(
    (robotId: string, signal: "CALL" | "PUT", stake: number, config: RobotConfig) => {
      const contractType = signal === "CALL" ? "CALL" : "PUT"
      
      // Convert duration to seconds
      let durationSeconds = config.duration
      if (config.durationType === "m") {
        durationSeconds = config.duration * 60
      } else if (config.durationType === "h") {
        durationSeconds = config.duration * 3600
      }

      // Determine basis duration unit
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

      const request = {
        buy: 1,
        price: stake,
        parameters: {
          contract_type: contractType,
          symbol: config.asset,
          duration,
          duration_unit: durationUnit,
          basis: "stake",
          amount: stake,
          currency: "USD",
        },
      }

      console.log("[v0] Sending buy request:", JSON.stringify(request))
      sendRequest(request)

      return request
    },
    [sendRequest]
  )

  // Handle buy results
  useEffect(() => {
    if (operationMode !== "real") return

    const unsubscribeBuy = onBuyResult((result: BuyContractResult) => {
      console.log("[v0] Buy result received:", result)
      
      // Find which robot has a pending operation and update it with contract_id
      setRobotStates((prev) => {
        const newStates = { ...prev }
        
        for (const robotId of Object.keys(newStates)) {
          const state = newStates[robotId]
          if (state.isRunning && state.operations.length > 0) {
            const lastOp = state.operations[state.operations.length - 1]
            if (lastOp.result === "pending" && !lastOp.contractId) {
              // Associate contract with this operation
              pendingContractsRef.current.set(result.contract_id, {
                robotId,
                operationId: lastOp.id,
              })
              
              newStates[robotId] = {
                ...state,
                operations: state.operations.map((op) =>
                  op.id === lastOp.id
                    ? { ...op, contractId: result.contract_id }
                    : op
                ),
              }
              break
            }
          }
        }
        
        return newStates
      })
    })

    return () => {
      unsubscribeBuy()
    }
  }, [operationMode, onBuyResult])

  // Handle contract updates
  useEffect(() => {
    if (operationMode !== "real") return

    const unsubscribeContract = onContractUpdate((update: ContractUpdate) => {
      console.log("[v0] Contract update received:", update)
      
      const pendingInfo = pendingContractsRef.current.get(update.contract_id)
      if (!pendingInfo) return

      // Only process finished contracts
      if (update.status !== "won" && update.status !== "lost") return

      const isWin = update.status === "won"
      const profit = update.profit

      setRobotStates((prev) => {
        const state = prev[pendingInfo.robotId]
        if (!state) return prev

        const config = robotConfigs[pendingInfo.robotId]
        if (!config) return prev

        const updatedOperations = state.operations.map((op) => {
          if (op.id === pendingInfo.operationId) {
            return {
              ...op,
              result: isWin ? "win" : "loss" as const,
              profit: profit,
            }
          }
          return op
        })

        // Remove from pending
        pendingContractsRef.current.delete(update.contract_id)

        return {
          ...prev,
          [pendingInfo.robotId]: {
            ...state,
            wins: isWin ? state.wins + 1 : state.wins,
            losses: !isWin ? state.losses + 1 : state.losses,
            profit: state.profit + profit,
            currentMartingaleLevel: isWin
              ? 0
              : Math.min(state.currentMartingaleLevel + 1, config.maxMartingale),
            operations: updatedOperations,
          },
        }
      })
    })

    return () => {
      unsubscribeContract()
    }
  }, [operationMode, onContractUpdate, robotConfigs])

  const startRobot = useCallback(
    (robotId: string) => {
      const config = robotConfigs[robotId]
      if (!config || !isConnected) return

      setRobotStates((prev) => ({
        ...prev,
        [robotId]: {
          ...prev[robotId],
          isRunning: true,
          initialBalance: balance?.balance || prev[robotId].initialBalance,
          currentBalance: balance?.balance || prev[robotId].currentBalance,
        },
      }))

      // Subscribe to ticks for the selected asset
      const unsubscribe = subscribeToTicks(config.asset, (tick) => {
        // Process tick and generate signals based on strategy
        processSignal(robotId, tick.price, tick.time)
      })

      tickUnsubscribeRef.current[robotId] = unsubscribe
    },
    [robotConfigs, isConnected, balance, subscribeToTicks]
  )

  const stopRobot = useCallback((robotId: string) => {
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

        // Check stop loss / stop gain
        if (state.profit <= -config.stopLoss || state.profit >= config.stopGain) {
          stopRobot(robotId)
          return prev
        }

        // Check if there's a pending operation
        if (state.operations.length > 0) {
          const lastOp = state.operations[state.operations.length - 1]
          
          // In REAL mode, we wait for the actual contract result from Deriv
          if (operationMode === "real" && lastOp.result === "pending") {
            return prev // Wait for real result
          }
          
          // In DEMO mode, simulate result
          if (operationMode === "demo" && lastOp.result === "pending") {
            // Check if operation should resolve
            const elapsed = Date.now() - lastOp.time.getTime()
            const duration = config.duration * (config.durationType === "m" ? 60000 : config.durationType === "h" ? 3600000 : 1000)
            
            if (elapsed >= duration) {
              // Resolve operation (demo: 55% win rate)
              const isWin = Math.random() > 0.45
              const currentStake = lastOp.stake

              if (config.virtualLoss && !isWin && state.virtualLossCount < config.virtualLossLimit) {
                // Virtual loss - don't count real loss
                return {
                  ...prev,
                  [robotId]: {
                    ...state,
                    virtualLossCount: state.virtualLossCount + 1,
                    operations: state.operations.map((op, idx) =>
                      idx === state.operations.length - 1
                        ? { ...op, result: "loss" as const, exit: price, profit: 0 }
                        : op
                    ),
                  },
                }
              }

              const profit = isWin ? currentStake * 0.85 : -currentStake
              const newBalance = state.currentBalance + profit

              return {
                ...prev,
                [robotId]: {
                  ...state,
                  wins: isWin ? state.wins + 1 : state.wins,
                  losses: !isWin ? state.losses + 1 : state.losses,
                  profit: state.profit + profit,
                  currentBalance: newBalance,
                  currentMartingaleLevel: isWin ? 0 : Math.min(state.currentMartingaleLevel + 1, config.maxMartingale),
                  virtualLossCount: isWin ? 0 : state.virtualLossCount,
                  operations: state.operations.map((op, idx) =>
                    idx === state.operations.length - 1
                      ? { ...op, result: isWin ? "win" : "loss" as const, exit: price, profit }
                      : op
                  ),
                },
              }
            }
            return prev
          }
        }

        // Generate new signal with 5% probability per tick
        if (Math.random() > 0.95) {
          const signal: "CALL" | "PUT" = generateSignal(robotId, price)
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

          // If in REAL mode, send buy request to Deriv
          if (operationMode === "real") {
            buyContract(robotId, signal, stake, config)
          }

          return {
            ...prev,
            [robotId]: {
              ...state,
              totalEntries: state.totalEntries + 1,
              operations: [...state.operations.slice(-49), newOperation],
              lastOperation: newOperation,
            },
          }
        }

        return prev
      })
    },
    [robotConfigs, stopRobot, operationMode, buyContract]
  )

  // Generate signal based on strategy
  const generateSignal = (robotId: string, price: number): "CALL" | "PUT" => {
    const strategy = strategies.find((s) => s.id === robotId)
    if (!strategy) return Math.random() > 0.5 ? "CALL" : "PUT"

    // Simple signal generation based on strategy type
    // In a real implementation, this would use actual technical indicators
    switch (strategy.type) {
      case "trend":
        // Trend follower - follow the momentum
        return Math.random() > 0.5 ? "CALL" : "PUT"
      case "reversal":
        // Reversal - counter trend
        return Math.random() > 0.5 ? "PUT" : "CALL"
      case "martingale":
        // Martingale - alternate direction
        return Math.random() > 0.5 ? "CALL" : "PUT"
      case "scalping":
        // Scalper - quick decisions
        return Math.random() > 0.5 ? "CALL" : "PUT"
      case "grid":
        // Grid - based on price levels
        return Math.random() > 0.5 ? "CALL" : "PUT"
      default:
        return Math.random() > 0.5 ? "CALL" : "PUT"
    }
  }

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

        <div className="flex items-center gap-4">
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
                <p className="font-medium text-primary">Modo Real Ativo</p>
                <p className="text-sm text-muted-foreground">
                  Os robos estao operando com dinheiro real na sua conta Deriv. Use com cuidado!
                </p>
              </div>
            </>
          ) : (
            <>
              <MonitorPlay className="h-5 w-5 text-chart-3" />
              <div>
                <p className="font-medium text-chart-3">Modo Demonstracao</p>
                <p className="text-sm text-muted-foreground">
                  Os robos estao simulando operacoes. Nenhuma operacao real sera executada.
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
