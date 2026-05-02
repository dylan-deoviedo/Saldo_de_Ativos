"use client"

import { useState, useMemo } from "react"
import { useDerivContext } from "@/contexts/deriv-context"
import { TradingChart } from "@/components/deriv/trading-chart"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Search,
  CandlestickChart,
  LineChart,
  AreaChart,
  Settings2,
  Star,
  Clock,
} from "lucide-react"

const TIMEFRAMES = [
  { value: "60", label: "1m", seconds: 60 },
  { value: "120", label: "2m", seconds: 120 },
  { value: "300", label: "5m", seconds: 300 },
  { value: "900", label: "15m", seconds: 900 },
  { value: "1800", label: "30m", seconds: 1800 },
  { value: "3600", label: "1h", seconds: 3600 },
  { value: "7200", label: "2h", seconds: 7200 },
  { value: "14400", label: "4h", seconds: 14400 },
  { value: "86400", label: "1D", seconds: 86400 },
]

const CHART_TYPES = [
  { value: "candles", label: "Candlestick", icon: CandlestickChart },
  { value: "line", label: "Linha", icon: LineChart },
  { value: "area", label: "Area", icon: AreaChart },
]

export default function ChartsPage() {
  const { assets, isConnected } = useDerivContext()
  const [selectedSymbol, setSelectedSymbol] = useState<string>("frxEURUSD")
  const [chartType, setChartType] = useState<"candles" | "line" | "area">("candles")
  const [timeframe, setTimeframe] = useState(60)
  const [searchQuery, setSearchQuery] = useState("")
  const [favorites, setFavorites] = useState<string[]>([])

  const selectedAsset = useMemo(() => {
    return assets.find((a) => a.symbol === selectedSymbol)
  }, [assets, selectedSymbol])

  const filteredAssets = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return assets.filter(
      (asset) =>
        asset.display_name.toLowerCase().includes(query) ||
        asset.symbol.toLowerCase().includes(query)
    )
  }, [assets, searchQuery])

  const groupedAssets = useMemo(() => {
    return filteredAssets.reduce((acc, asset) => {
      const market = asset.market_display_name
      if (!acc[market]) {
        acc[market] = []
      }
      acc[market].push(asset)
      return acc
    }, {} as Record<string, typeof assets>)
  }, [filteredAssets])

  const toggleFavorite = (symbol: string) => {
    setFavorites((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    )
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Conecte-se para ver os graficos</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Asset Selector */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[200px] justify-start">
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10">
                  <CandlestickChart className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{selectedAsset?.display_name || selectedSymbol}</p>
                  <p className="text-xs text-muted-foreground">{selectedAsset?.market_display_name}</p>
                </div>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Selecionar Ativo</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar ativo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {favorites.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Star className="h-4 w-4 fill-chart-3 text-chart-3" />
                      Favoritos
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {favorites.map((symbol) => {
                        const asset = assets.find((a) => a.symbol === symbol)
                        return asset ? (
                          <Button
                            key={symbol}
                            variant={selectedSymbol === symbol ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setSelectedSymbol(symbol)}
                            className="gap-1"
                          >
                            {asset.display_name}
                          </Button>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-6 pr-4">
                    {Object.entries(groupedAssets).map(([market, marketAssets]) => (
                      <div key={market}>
                        <h3 className="text-sm font-medium text-muted-foreground mb-2">
                          {market}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {marketAssets.length}
                          </Badge>
                        </h3>
                        <div className="grid gap-1">
                          {marketAssets.map((asset) => (
                            <button
                              key={asset.symbol}
                              onClick={() => setSelectedSymbol(asset.symbol)}
                              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary ${
                                selectedSymbol === asset.symbol
                                  ? "bg-primary/10 text-primary"
                                  : ""
                              }`}
                            >
                              <div>
                                <p className="text-sm font-medium">{asset.display_name}</p>
                                <p className="text-xs text-muted-foreground">{asset.symbol}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleFavorite(asset.symbol)
                                }}
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    favorites.includes(asset.symbol)
                                      ? "fill-chart-3 text-chart-3"
                                      : "text-muted-foreground"
                                  }`}
                                />
                              </Button>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>

          {/* Chart Type */}
          <div className="flex items-center rounded-lg border border-border bg-secondary/30 p-1">
            {CHART_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={chartType === type.value ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5 px-3"
                onClick={() => setChartType(type.value as typeof chartType)}
              >
                <type.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{type.label}</span>
              </Button>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Select
              value={timeframe.toString()}
              onValueChange={(v) => setTimeframe(parseInt(v))}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 bg-background">
        <TradingChart
          symbol={selectedSymbol}
          chartType={chartType}
          timeframe={timeframe}
        />
      </div>
    </div>
  )
}
