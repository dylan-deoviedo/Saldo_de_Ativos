"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Play,
  Square,
  RotateCcw,
  Settings,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Clock,
  Zap,
  Target,
  AlertCircle,
  MonitorPlay,
} from "lucide-react"
import type { RobotStrategy, RobotConfig, RobotState, Operation, OperationMode } from "@/app/robots/page"
import type { DerivAsset } from "@/contexts/deriv-context"

interface RobotCardProps {
  strategy: RobotStrategy
  config: RobotConfig
  state?: RobotState
  assets: DerivAsset[]
  operationMode: OperationMode
  onStart: () => void
  onStop: () => void
  onReset: () => void
  onConfigure: () => void
}

export function RobotCard({
  strategy,
  config,
  state,
  assets,
  operationMode,
  onStart,
  onStop,
  onReset,
  onConfigure,
}: RobotCardProps) {
  const [expanded, setExpanded] = useState(false)
  const Icon = strategy.icon

  const winRate = state && state.totalEntries > 0
    ? ((state.wins / state.totalEntries) * 100).toFixed(1)
    : "0.0"

  const assetName = assets.find((a) => a.symbol === config.asset)?.display_name || config.asset

  const getStatusColor = () => {
    if (!state?.isRunning) return "bg-muted text-muted-foreground"
    if (state.profit > 0) return "bg-primary/20 text-primary"
    if (state.profit < 0) return "bg-destructive/20 text-destructive"
    return "bg-chart-3/20 text-chart-3"
  }

  const getStatusText = () => {
    if (!state?.isRunning) return "Parado"
    if (state.lastOperation?.result === "pending") return "Analisando..."
    return "Operando"
  }

  return (
    <Card className="overflow-hidden border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-secondary ${strategy.color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{strategy.name}</h3>
              <p className="text-xs text-muted-foreground">{strategy.description}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge className={getStatusColor()}>{getStatusText()}</Badge>
            {state?.isRunning && (
              <Badge 
                variant="outline" 
                className={`text-[10px] ${operationMode === "real" ? "border-primary text-primary" : "border-chart-3 text-chart-3"}`}
              >
                {operationMode === "real" ? (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    Real
                  </>
                ) : (
                  <>
                    <MonitorPlay className="h-3 w-3 mr-1" />
                    Demo
                  </>
                )}
              </Badge>
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded-lg bg-secondary/50">
            <p className="text-lg font-bold text-foreground">{state?.totalEntries || 0}</p>
            <p className="text-[10px] text-muted-foreground">Entradas</p>
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <p className="text-lg font-bold text-primary">{state?.wins || 0}</p>
            <p className="text-[10px] text-muted-foreground">Acertos</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10">
            <p className="text-lg font-bold text-destructive">{state?.losses || 0}</p>
            <p className="text-[10px] text-muted-foreground">Erros</p>
          </div>
          <div className="p-2 rounded-lg bg-chart-3/10">
            <p className="text-lg font-bold text-chart-3">{winRate}%</p>
            <p className="text-[10px] text-muted-foreground">Win Rate</p>
          </div>
        </div>
      </div>

      {/* Profit Section */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Lucro/Prejuizo</span>
          <span
            className={`text-lg font-bold ${
              (state?.profit || 0) >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {(state?.profit || 0) >= 0 ? "+" : ""}
            {(state?.profit || 0).toFixed(2)} USD
          </span>
        </div>

        {/* Progress to Stop Loss / Stop Gain */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-destructive">Stop Loss: -{config.stopLoss}</span>
            <span className="text-primary">Stop Gain: +{config.stopGain}</span>
          </div>
          <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="absolute h-full bg-gradient-to-r from-destructive via-chart-3 to-primary"
              style={{
                left: "0%",
                width: "100%",
              }}
            />
            <div
              className="absolute h-full w-1 bg-foreground rounded-full"
              style={{
                left: `${Math.max(0, Math.min(100, 50 + ((state?.profit || 0) / (config.stopLoss + config.stopGain)) * 100))}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Config Summary */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Zap className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Banca:</span>
            <span className="text-foreground font-medium">{config.stake} USD</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Gale:</span>
            <span className="text-foreground font-medium">
              {config.martingale}x (Max: {config.maxMartingale})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Duracao:</span>
            <span className="text-foreground font-medium">
              {config.duration}
              {config.durationType === "m" ? "min" : config.durationType === "h" ? "h" : "s"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Loss Virtual:</span>
            <span className={`font-medium ${config.virtualLoss ? "text-primary" : "text-muted-foreground"}`}>
              {config.virtualLoss ? `Sim (${config.virtualLossLimit}x)` : "Nao"}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ativo:</span>
          <Badge variant="secondary" className="text-xs">
            {assetName}
          </Badge>
        </div>

        {state?.isRunning && state.currentMartingaleLevel > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-chart-3/10 border border-chart-3/30">
            <div className="flex items-center gap-2 text-chart-3 text-xs">
              <AlertCircle className="h-3 w-3" />
              <span>Martingale Nivel {state.currentMartingaleLevel}</span>
            </div>
          </div>
        )}
      </div>

      {/* Operations List (Expandable) */}
      <div className="border-b border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full p-3 flex items-center justify-between text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
        >
          <span>Operacoes ({state?.operations.length || 0})</span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {expanded && (
          <ScrollArea className="h-48">
            <div className="p-2 space-y-1">
              {state?.operations.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Nenhuma operacao ainda
                </p>
              ) : (
                [...(state?.operations || [])].reverse().map((op) => (
                  <OperationRow key={op.id} operation={op} />
                ))
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 flex gap-2">
        {state?.isRunning ? (
          <Button variant="destructive" size="sm" className="flex-1" onClick={onStop}>
            <Square className="h-4 w-4 mr-2" />
            Parar
          </Button>
        ) : (
          <Button 
            variant={operationMode === "real" ? "default" : "outline"} 
            size="sm" 
            className={`flex-1 ${operationMode === "real" ? "" : "border-chart-3 text-chart-3 hover:bg-chart-3/10"}`}
            onClick={onStart}
          >
            {operationMode === "real" ? (
              <Zap className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {operationMode === "real" ? "Operar Real" : "Iniciar Demo"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onReset} disabled={state?.isRunning}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={onConfigure} disabled={state?.isRunning}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

function OperationRow({ operation }: { operation: Operation }) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  return (
    <div
      className={`flex items-center justify-between p-2 rounded-lg text-xs ${
        operation.result === "win"
          ? "bg-primary/10"
          : operation.result === "loss"
          ? "bg-destructive/10"
          : "bg-secondary/50"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{formatTime(operation.time)}</span>
        <Badge
          variant={operation.type === "CALL" ? "default" : "secondary"}
          className={`text-[10px] ${
            operation.type === "CALL"
              ? "bg-primary/20 text-primary"
              : "bg-destructive/20 text-destructive"
          }`}
        >
          {operation.type === "CALL" ? (
            <TrendingUp className="h-3 w-3 mr-1" />
          ) : (
            <TrendingDown className="h-3 w-3 mr-1" />
          )}
          {operation.type}
        </Badge>
        {operation.martingaleLevel > 0 && (
          <Badge variant="outline" className="text-[10px] text-chart-3 border-chart-3/50">
            G{operation.martingaleLevel}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">{operation.stake.toFixed(2)} USD</span>
        {operation.result === "pending" ? (
          <Badge variant="secondary" className="text-[10px]">
            Pendente
          </Badge>
        ) : (
          <span
            className={`font-medium ${
              operation.result === "win" ? "text-primary" : "text-destructive"
            }`}
          >
            {operation.result === "win" ? "+" : ""}
            {operation.profit?.toFixed(2)} USD
          </span>
        )}
      </div>
    </div>
  )
}
