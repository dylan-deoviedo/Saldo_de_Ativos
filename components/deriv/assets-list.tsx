"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, LineChart, TrendingUp, Coins, Globe } from "lucide-react"
import type { DerivAsset } from "@/contexts/deriv-context"

interface AssetsListProps {
  assets: DerivAsset[]
}

const marketIcons: Record<string, React.ReactNode> = {
  forex: <Globe className="h-4 w-4" />,
  indices: <LineChart className="h-4 w-4" />,
  commodities: <Coins className="h-4 w-4" />,
  synthetic_index: <TrendingUp className="h-4 w-4" />,
  cryptocurrency: <Coins className="h-4 w-4" />,
}

const marketColors: Record<string, string> = {
  forex: "bg-chart-2/20 text-chart-2",
  indices: "bg-chart-3/20 text-chart-3",
  commodities: "bg-chart-5/20 text-chart-5",
  synthetic_index: "bg-primary/20 text-primary",
  cryptocurrency: "bg-chart-4/20 text-chart-4",
}

export function AssetsList({ assets }: AssetsListProps) {
  const [search, setSearch] = useState("")

  const filteredAssets = assets.filter(
    (asset) =>
      asset.display_name.toLowerCase().includes(search.toLowerCase()) ||
      asset.symbol.toLowerCase().includes(search.toLowerCase()) ||
      asset.market_display_name.toLowerCase().includes(search.toLowerCase())
  )

  // Group by market
  const groupedAssets = filteredAssets.reduce((acc, asset) => {
    const market = asset.market_display_name
    if (!acc[market]) {
      acc[market] = []
    }
    acc[market].push(asset)
    return acc
  }, {} as Record<string, DerivAsset[]>)

  const totalAssets = assets.length

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ativos Disponíveis
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {totalAssets} ativos
          </Badge>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar ativos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 pb-6">
          {Object.keys(groupedAssets).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <LineChart className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">
                {assets.length === 0
                  ? "Conecte-se para ver os ativos"
                  : "Nenhum ativo encontrado"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedAssets).map(([market, marketAssets]) => (
                <div key={market}>
                  <div className="sticky top-0 bg-card py-2 flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {market}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {marketAssets.length}
                    </Badge>
                  </div>
                  <div className="grid gap-2">
                    {marketAssets.slice(0, 10).map((asset) => (
                      <div
                        key={asset.symbol}
                        className="flex items-center justify-between rounded-lg bg-secondary/30 p-3 hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                              marketColors[asset.market] || "bg-secondary text-foreground"
                            }`}
                          >
                            {marketIcons[asset.market] || (
                              <LineChart className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {asset.display_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {asset.symbol}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className="text-xs capitalize"
                        >
                          {asset.submarket_display_name}
                        </Badge>
                      </div>
                    ))}
                    {marketAssets.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        +{marketAssets.length - 10} mais ativos
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
