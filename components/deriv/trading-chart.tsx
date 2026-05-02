"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  ColorType,
  CrosshairMode,
  type CandlestickData,
  type LineData,
  type Time,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
} from "lightweight-charts"
import { useDerivContext, type OHLCCandle, type TickData } from "@/contexts/deriv-context"
import { Button } from "@/components/ui/button"
import {
  Minus,
  TrendingUp,
  Crosshair,
  MousePointer2,
  Trash2,
  Ruler,
  Square,
  Circle,
  ArrowUpRight,
  Type,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TradingChartProps {
  symbol: string
  chartType: "candles" | "line" | "area"
  timeframe: number // in seconds
}

type DrawingMode = "none" | "line" | "horizontal" | "trendline" | "fibonacci" | "measure"

interface DrawingLine {
  id: string
  type: DrawingMode
  points: { time: Time; price: number }[]
  color: string
}

export function TradingChart({ symbol, chartType, timeframe }: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<typeof CandlestickSeries> | ISeriesApi<typeof LineSeries> | ISeriesApi<typeof AreaSeries> | null>(null)
  const drawingsRef = useRef<DrawingLine[]>([])
  const [drawingMode, setDrawingMode] = useState<DrawingMode>("none")
  const [isLoading, setIsLoading] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<{ value: number; percent: number } | null>(null)
  const [seriesReady, setSeriesReady] = useState(false)
  const currentDrawingRef = useRef<DrawingLine | null>(null)
  const lineSeriesRef = useRef<Map<string, ISeriesApi<typeof LineSeries>>>(new Map())

  const { getTicksHistory, subscribeToCandles, subscribeToTicks, isConnected } = useDerivContext()

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#a1a1aa",
        fontFamily: "Geist, system-ui, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(42, 46, 57, 0.3)" },
        horzLines: { color: "rgba(42, 46, 57, 0.3)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#4ade80",
          width: 1,
          style: 2,
          labelBackgroundColor: "#4ade80",
        },
        horzLine: {
          color: "#4ade80",
          width: 1,
          style: 2,
          labelBackgroundColor: "#4ade80",
        },
      },
      timeScale: {
        borderColor: "rgba(42, 46, 57, 0.5)",
        timeVisible: true,
        secondsVisible: timeframe < 60,
      },
      rightPriceScale: {
        borderColor: "rgba(42, 46, 57, 0.5)",
      },
      handleScroll: {
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        pinch: true,
        mouseWheel: true,
      },
    })

    chartRef.current = chart

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chart) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    window.addEventListener("resize", handleResize)
    handleResize()

    return () => {
      window.removeEventListener("resize", handleResize)
      // Clear series ref before removing chart
      seriesRef.current = null
      // Clear line series
      lineSeriesRef.current.clear()
      chart.remove()
      chartRef.current = null
    }
  }, [timeframe])

  // Create series based on chart type
  useEffect(() => {
    if (!chartRef.current) return

    setSeriesReady(false)

    // Remove existing series safely
    if (seriesRef.current) {
      try {
        chartRef.current.removeSeries(seriesRef.current)
      } catch {
        // Series may have already been removed
      }
      seriesRef.current = null
    }

    switch (chartType) {
      case "candles":
        seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
          upColor: "#4ade80",
          downColor: "#ef4444",
          borderUpColor: "#4ade80",
          borderDownColor: "#ef4444",
          wickUpColor: "#4ade80",
          wickDownColor: "#ef4444",
        })
        break
      case "line":
        seriesRef.current = chartRef.current.addSeries(LineSeries, {
          color: "#4ade80",
          lineWidth: 2,
        })
        break
      case "area":
        seriesRef.current = chartRef.current.addSeries(AreaSeries, {
          topColor: "rgba(74, 222, 128, 0.4)",
          bottomColor: "rgba(74, 222, 128, 0.0)",
          lineColor: "#4ade80",
          lineWidth: 2,
        })
        break
    }
    
    setSeriesReady(true)
  }, [chartType])

  // Load historical data and subscribe to updates
  useEffect(() => {
    if (!seriesReady || !seriesRef.current || !isConnected || !symbol) return

    setIsLoading(true)
    let unsubscribe: (() => void) | null = null

    const loadData = async () => {
      try {
        const count = Math.min(1000, Math.max(100, Math.floor(86400 / timeframe) * 7))
        
        if (chartType === "candles") {
          // Register callback BEFORE making the request so we don't miss any updates
          console.log("[v0] Setting up candle subscription:", symbol, timeframe)
          unsubscribe = subscribeToCandles(symbol, timeframe, (candle) => {
            console.log("[v0] Candle callback received:", candle.close, "seriesRef:", !!seriesRef.current)
            if (seriesRef.current) {
              const newData: CandlestickData = {
                time: candle.time as Time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
              }
              seriesRef.current.update(newData)
              setCurrentPrice(candle.close)
            }
          })
          
          // Load history WITH subscribe flag for real-time updates
          const candles = await getTicksHistory(symbol, count, timeframe, true) as OHLCCandle[]
          
          if (candles.length > 0 && seriesRef.current) {
            const data: CandlestickData[] = candles.map((c) => ({
              time: c.time as Time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
            seriesRef.current.setData(data)

            const lastCandle = candles[candles.length - 1]
            const firstCandle = candles[0]
            setCurrentPrice(lastCandle.close)
            const change = lastCandle.close - firstCandle.open
            const percent = (change / firstCandle.open) * 100
            setPriceChange({ value: change, percent })
          }
        } else {
          // Line or area chart - use ticks
          // Register callback BEFORE making the request
          console.log("[v0] Setting up tick subscription:", symbol)
          unsubscribe = subscribeToTicks(symbol, (tick) => {
            console.log("[v0] Tick callback received:", tick.price, "seriesRef:", !!seriesRef.current)
            if (seriesRef.current) {
              const newData: LineData = {
                time: tick.time as Time,
                value: tick.price,
              }
              seriesRef.current.update(newData)
              setCurrentPrice(tick.price)
            }
          })
          
          // Load history WITH subscribe flag for real-time updates
          const ticks = await getTicksHistory(symbol, count, undefined, true) as TickData[]
          
          if (ticks.length > 0 && seriesRef.current) {
            const data: LineData[] = ticks.map((t) => ({
              time: t.time as Time,
              value: t.price,
            }))
            seriesRef.current.setData(data)

            const lastTick = ticks[ticks.length - 1]
            const firstTick = ticks[0]
            setCurrentPrice(lastTick.price)
            const change = lastTick.price - firstTick.price
            const percent = (change / firstTick.price) * 100
            setPriceChange({ value: change, percent })
          }
        }
      } catch (error) {
        console.error("Error loading chart data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()

    return () => {
      console.log("[v0] Cleanup: unsubscribing")
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [symbol, timeframe, chartType, isConnected, seriesReady, getTicksHistory, subscribeToCandles, subscribeToTicks])

  // Handle chart clicks for drawing
  const handleChartClick = useCallback((param: { time?: Time; point?: { x: number; y: number }; }) => {
    if (drawingMode === "none" || !chartRef.current || !param.time) return

    const price = seriesRef.current?.coordinateToPrice(param.point?.y || 0) || 0

    if (!currentDrawingRef.current) {
      // Start new drawing
      const newDrawing: DrawingLine = {
        id: Date.now().toString(),
        type: drawingMode,
        points: [{ time: param.time, price }],
        color: "#fbbf24",
      }
      currentDrawingRef.current = newDrawing

      if (drawingMode === "horizontal") {
        // Horizontal line is complete with one point
        newDrawing.points.push({ time: param.time, price })
        drawingsRef.current.push(newDrawing)
        renderDrawing(newDrawing)
        currentDrawingRef.current = null
        setDrawingMode("none")
      }
    } else {
      // Complete the drawing
      currentDrawingRef.current.points.push({ time: param.time, price })
      drawingsRef.current.push(currentDrawingRef.current)
      renderDrawing(currentDrawingRef.current)
      currentDrawingRef.current = null
      
      if (drawingMode !== "fibonacci") {
        setDrawingMode("none")
      }
    }
  }, [drawingMode])

  // Render drawing on chart
  const renderDrawing = useCallback((drawing: DrawingLine) => {
    if (!chartRef.current || drawing.points.length < 2) return

    const lineSeries = chartRef.current.addSeries(LineSeries, {
      color: drawing.color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    const data: LineData[] = drawing.points.map((p) => ({
      time: p.time,
      value: p.price,
    }))
    lineSeries.setData(data)
    lineSeriesRef.current.set(drawing.id, lineSeries)

    // For Fibonacci, add levels
    if (drawing.type === "fibonacci" && drawing.points.length >= 2) {
      const [p1, p2] = drawing.points
      const diff = p2.price - p1.price
      const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
      
      levels.forEach((level) => {
        const price = p1.price + diff * level
        const fibSeries = chartRef.current!.addSeries(LineSeries, {
          color: `rgba(251, 191, 36, ${0.3 + level * 0.5})`,
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        fibSeries.setData([
          { time: p1.time, value: price },
          { time: p2.time, value: price },
        ])
        lineSeriesRef.current.set(`${drawing.id}_fib_${level}`, fibSeries)
      })
    }
  }, [])

  // Subscribe to chart clicks
  useEffect(() => {
    if (!chartRef.current) return

    chartRef.current.subscribeClick(handleChartClick)

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick)
    }
  }, [handleChartClick])

  // Clear all drawings
  const clearDrawings = () => {
    lineSeriesRef.current.forEach((series) => {
      try {
        chartRef.current?.removeSeries(series)
      } catch {
        // Series may have already been removed
      }
    })
    lineSeriesRef.current.clear()
    drawingsRef.current = []
    currentDrawingRef.current = null
  }

  const drawingTools: { mode: DrawingMode; icon: React.ReactNode; label: string }[] = [
    { mode: "none", icon: <MousePointer2 className="h-4 w-4" />, label: "Selecionar" },
    { mode: "line", icon: <Minus className="h-4 w-4" />, label: "Linha" },
    { mode: "trendline", icon: <TrendingUp className="h-4 w-4" />, label: "Linha de Tendencia" },
    { mode: "horizontal", icon: <Crosshair className="h-4 w-4" />, label: "Linha Horizontal" },
    { mode: "fibonacci", icon: <Ruler className="h-4 w-4" />, label: "Fibonacci" },
  ]

  const handleZoomIn = () => {
    chartRef.current?.timeScale().zoomIn()
  }

  const handleZoomOut = () => {
    chartRef.current?.timeScale().zoomOut()
  }

  const handleFitContent = () => {
    chartRef.current?.timeScale().fitContent()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-border bg-card/50 px-4 py-2">
        <TooltipProvider>
          {drawingTools.map((tool) => (
            <Tooltip key={tool.mode}>
              <TooltipTrigger asChild>
                <Button
                  variant={drawingMode === tool.mode ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setDrawingMode(tool.mode)}
                >
                  {tool.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tool.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          
          <div className="h-6 w-px bg-border mx-2" />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={clearDrawings}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Limpar Desenhos</p>
            </TooltipContent>
          </Tooltip>

          <div className="h-6 w-px bg-border mx-2" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomIn}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Aumentar Zoom</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleZoomOut}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Diminuir Zoom</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleFitContent}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ajustar ao Conteudo</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto flex items-center gap-4">
          {currentPrice !== null && (
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                {currentPrice.toFixed(symbol.includes("JPY") ? 3 : 5)}
              </p>
              {priceChange && (
                <p
                  className={`text-xs ${
                    priceChange.value >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {priceChange.value >= 0 ? "+" : ""}
                  {priceChange.value.toFixed(5)} ({priceChange.percent.toFixed(2)}%)
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span>Carregando grafico...</span>
            </div>
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
