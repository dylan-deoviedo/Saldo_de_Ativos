"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import {
  DollarSign,
  Target,
  Clock,
  Shield,
  TrendingUp,
  Settings,
  Zap,
  AlertTriangle,
} from "lucide-react"
import type { RobotConfig } from "@/app/robots/page"
import type { DerivAsset } from "@/contexts/deriv-context"

interface RobotConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: RobotConfig
  onSave: (config: RobotConfig) => void
  assets: DerivAsset[]
  strategyName: string
}

export function RobotConfigModal({
  open,
  onOpenChange,
  config,
  onSave,
  assets,
  strategyName,
}: RobotConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<RobotConfig>(config)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const handleSave = () => {
    onSave(localConfig)
  }

  const syntheticAssets = assets.filter((a) =>
    ["synthetic_index", "basket_index"].includes(a.market)
  )

  const groupedAssets = syntheticAssets.reduce((acc, asset) => {
    const group = asset.submarket_display_name || asset.market_display_name
    if (!acc[group]) acc[group] = []
    acc[group].push(asset)
    return acc
  }, {} as Record<string, DerivAsset[]>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Configurar {strategyName}
          </DialogTitle>
          <DialogDescription>
            Ajuste os parametros do robo antes de iniciar as operacoes
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="trading" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trading">Trading</TabsTrigger>
            <TabsTrigger value="risk">Gerenciamento</TabsTrigger>
            <TabsTrigger value="advanced">Avancado</TabsTrigger>
          </TabsList>

          {/* Trading Tab */}
          <TabsContent value="trading" className="space-y-4">
            {/* Asset Selection */}
            <Card className="p-4">
              <Label className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ativo para Operar
              </Label>
              <Select
                value={localConfig.asset}
                onValueChange={(value) =>
                  setLocalConfig((prev) => ({ ...prev, asset: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um ativo" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(groupedAssets).map(([group, groupAssets]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        {group}
                      </div>
                      {groupAssets.map((asset) => (
                        <SelectItem key={asset.symbol} value={asset.symbol}>
                          {asset.display_name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </Card>

            {/* Stake */}
            <Card className="p-4">
              <Label className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4 text-primary" />
                Valor da Banca (USD)
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[localConfig.stake]}
                  onValueChange={([value]) =>
                    setLocalConfig((prev) => ({ ...prev, stake: value }))
                  }
                  min={0.35}
                  max={100}
                  step={0.01}
                  className="flex-1"
                />
                <Input
                  type="number"
                  value={localConfig.stake}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      stake: parseFloat(e.target.value) || 0.35,
                    }))
                  }
                  className="w-24"
                  min={0.35}
                  step={0.01}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Valor minimo: 0.35 USD
              </p>
            </Card>

            {/* Duration */}
            <Card className="p-4">
              <Label className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-primary" />
                Duracao do Contrato
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={localConfig.duration}
                  onChange={(e) =>
                    setLocalConfig((prev) => ({
                      ...prev,
                      duration: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="w-24"
                  min={1}
                />
                <Select
                  value={localConfig.durationType}
                  onValueChange={(value: "t" | "m" | "h") =>
                    setLocalConfig((prev) => ({ ...prev, durationType: value }))
                  }
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t">Ticks</SelectItem>
                    <SelectItem value="m">Minutos</SelectItem>
                    <SelectItem value="h">Horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          </TabsContent>

          {/* Risk Management Tab */}
          <TabsContent value="risk" className="space-y-4">
            {/* Martingale */}
            <Card className="p-4">
              <Label className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-chart-3" />
                Configuracao de Martingale (Gale)
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Multiplicador
                  </Label>
                  <Select
                    value={localConfig.martingale.toString()}
                    onValueChange={(value) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        martingale: parseFloat(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="2.5">2.5x</SelectItem>
                      <SelectItem value="3">3x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Maximo de Gales
                  </Label>
                  <Select
                    value={localConfig.maxMartingale.toString()}
                    onValueChange={(value) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        maxMartingale: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sem Gale</SelectItem>
                      <SelectItem value="1">1 Gale</SelectItem>
                      <SelectItem value="2">2 Gales</SelectItem>
                      <SelectItem value="3">3 Gales</SelectItem>
                      <SelectItem value="4">4 Gales</SelectItem>
                      <SelectItem value="5">5 Gales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Martingale Preview */}
              {localConfig.maxMartingale > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-secondary/50">
                  <p className="text-xs text-muted-foreground mb-2">
                    Progressao de valores:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: localConfig.maxMartingale + 1 }).map((_, i) => {
                      const value = localConfig.stake * Math.pow(localConfig.martingale, i)
                      return (
                        <span
                          key={i}
                          className={`text-xs px-2 py-1 rounded ${
                            i === 0
                              ? "bg-primary/20 text-primary"
                              : "bg-chart-3/20 text-chart-3"
                          }`}
                        >
                          {i === 0 ? "Entrada" : `G${i}`}: {value.toFixed(2)}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Stop Loss / Stop Gain */}
            <Card className="p-4">
              <Label className="flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-primary" />
                Limites de Operacao
              </Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-destructive mb-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Stop Loss (USD)
                  </Label>
                  <Input
                    type="number"
                    value={localConfig.stopLoss}
                    onChange={(e) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        stopLoss: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                  />
                </div>
                <div>
                  <Label className="text-xs text-primary mb-2 flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Stop Gain (USD)
                  </Label>
                  <Input
                    type="number"
                    value={localConfig.stopGain}
                    onChange={(e) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        stopGain: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-4">
            {/* Virtual Loss */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-chart-2" />
                  Loss Virtual
                </Label>
                <Switch
                  checked={localConfig.virtualLoss}
                  onCheckedChange={(checked) =>
                    setLocalConfig((prev) => ({ ...prev, virtualLoss: checked }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Quando ativado, as primeiras perdas nao serao contabilizadas no saldo real
              </p>

              {localConfig.virtualLoss && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Limite de Perdas Virtuais
                  </Label>
                  <Select
                    value={localConfig.virtualLossLimit.toString()}
                    onValueChange={(value) =>
                      setLocalConfig((prev) => ({
                        ...prev,
                        virtualLossLimit: parseInt(value),
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 perda virtual</SelectItem>
                      <SelectItem value="2">2 perdas virtuais</SelectItem>
                      <SelectItem value="3">3 perdas virtuais</SelectItem>
                      <SelectItem value="5">5 perdas virtuais</SelectItem>
                      <SelectItem value="10">10 perdas virtuais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>

            {/* Info Card */}
            <Card className="p-4 bg-chart-2/5 border-chart-2/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-chart-2 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Modo Demonstracao
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Este robo opera em modo de demonstracao conectado a conta demo da Deriv.
                    As operacoes sao executadas em tempo real mas com saldo virtual.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar Configuracao</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
