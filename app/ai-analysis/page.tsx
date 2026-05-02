"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useDerivContext, type TickData, type OHLCCandle } from "@/contexts/deriv-context"
import { AppLayout } from "@/components/deriv/app-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  TrendingUp,
  TrendingDown,
  Brain,
  Activity,
  Target,
  Save,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Heart,
  Crown,
  Skull,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Dna,
  Settings2,
  CandlestickChart,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types
interface TrendAnalysis {
  direction: "up" | "down" | "lateral"
  strength: number
  confidence: number
}

interface SupportResistance {
  type: "support" | "resistance"
  price: number
  strength: number
  active: boolean
}

interface TechnicalIndicator {
  name: string
  value: number
  signal: "buy" | "sell" | "neutral"
  description: string
}

interface Prediction {
  id: string
  timestamp: number
  direction: "CALL" | "PUT"
  confidence: number
  entryPrice: number
  result?: "win" | "loss" | "pending"
  exitPrice?: number
  candleOpen?: number
  candleClose?: number
}

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
  direction: "up" | "down"
}

interface AIBrain {
  id: string
  name: string
  generation: number
  lives: number
  maxLives: number
  wins: number
  losses: number
  accuracy: number
  weights: number[]
  isActive: boolean
  currentPrediction: Prediction | null
  lastCandleDirection?: "up" | "down"
}

// Neural Network
class NeuralNetwork {
  weights: number[]
  
  constructor(weights?: number[]) {
    this.weights = weights || this.initializeWeights()
  }
  
  initializeWeights(): number[] {
    const weights: number[] = []
    for (let i = 0; i < 331; i++) {
      weights.push(Math.random() * 2 - 1)
    }
    return weights
  }
  
  sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
  }
  
  predict(inputs: number[]): number {
    const normalizedInputs = inputs.slice(0, 30)
    while (normalizedInputs.length < 30) {
      normalizedInputs.push(0)
    }
    
    const hidden: number[] = []
    for (let i = 0; i < 10; i++) {
      let sum = this.weights[300 + i]
      for (let j = 0; j < 30; j++) {
        sum += normalizedInputs[j] * this.weights[i * 30 + j]
      }
      hidden.push(this.sigmoid(sum))
    }
    
    let output = this.weights[330]
    for (let i = 0; i < 10; i++) {
      output += hidden[i] * this.weights[310 + i]
    }
    
    return this.sigmoid(output)
  }
  
  mutate(rate: number = 0.1): number[] {
    return this.weights.map(w => {
      if (Math.random() < rate) {
        return w + (Math.random() * 2 - 1) * 0.5
      }
      return w
    })
  }
  
  train(inputs: number[], target: number, learningRate: number = 0.01) {
    const output = this.predict(inputs)
    const error = target - output
    this.weights = this.weights.map((w, i) => {
      const inputIndex = i % 30
      const adjustment = error * learningRate * (inputs[inputIndex] || 0)
      return w + adjustment
    })
  }
}

// Feature extraction
function extractFeatures(
  ticks: TickData[],
  candles1m: OHLCCandle[],
  candles5m: OHLCCandle[],
  candles15m: OHLCCandle[],
  candles1h: OHLCCandle[],
  trends: Record<string, TrendAnalysis>
): number[] {
  const features: number[] = []
  
  if (ticks.length < 10) {
    return Array(30).fill(0)
  }
  
  const prices = ticks.slice(-30).map(t => t.price)
  
  // Price momentum
  const recent5 = prices.slice(-5)
  const prev5 = prices.slice(-10, -5)
  const recentAvg = recent5.reduce((a, b) => a + b, 0) / 5
  const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / 5 : recentAvg
  features.push((recentAvg - prevAvg) / prevAvg * 100)
  
  // Recent price changes
  for (let i = 1; i <= 5 && i < prices.length; i++) {
    const change = (prices[prices.length - i] - prices[prices.length - i - 1]) / prices[prices.length - i - 1] * 100
    features.push(change)
  }
  while (features.length < 6) features.push(0)
  
  // Volatility
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length
  features.push(Math.sqrt(variance) / mean * 100)
  
  // RSI
  let gains = 0, losses = 0
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }
  const rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses))
  features.push(rsi / 100)
  
  // Trend features
  features.push(trends["1m"]?.direction === "up" ? 1 : trends["1m"]?.direction === "down" ? -1 : 0)
  features.push(trends["5m"]?.direction === "up" ? 1 : trends["5m"]?.direction === "down" ? -1 : 0)
  features.push(trends["15m"]?.direction === "up" ? 1 : trends["15m"]?.direction === "down" ? -1 : 0)
  features.push(trends["1h"]?.direction === "up" ? 1 : trends["1h"]?.direction === "down" ? -1 : 0)
  features.push((trends["1m"]?.strength || 50) / 100)
  features.push((trends["5m"]?.strength || 50) / 100)
  
  // Candle patterns from different timeframes
  const addCandleFeatures = (candles: OHLCCandle[]) => {
    if (candles.length >= 3) {
      const last = candles[candles.length - 1]
      const prev = candles[candles.length - 2]
      features.push((last.close - last.open) / last.open * 100)
      features.push((prev.close - prev.open) / prev.open * 100)
      features.push(last.close > last.open ? 1 : -1)
    } else {
      features.push(0, 0, 0)
    }
  }
  
  addCandleFeatures(candles1m)
  addCandleFeatures(candles5m)
  addCandleFeatures(candles15m)
  addCandleFeatures(candles1h)
  
  while (features.length < 30) features.push(0)
  return features.slice(0, 30)
}

export default function AIAnalysisPage() {
  const { assets, isConnected, subscribeToTicks, getTicksHistory, subscribeToCandles } = useDerivContext()
  
  // Asset selection
  const [selectedAsset, setSelectedAsset] = useState<string>("")
  
  // Market data for different timeframes
  const [ticks, setTicks] = useState<TickData[]>([])
  const [candles1m, setCandles1m] = useState<OHLCCandle[]>([])
  const [candles5m, setCandles5m] = useState<OHLCCandle[]>([])
  const [candles15m, setCandles15m] = useState<OHLCCandle[]>([])
  const [candles1h, setCandles1h] = useState<OHLCCandle[]>([])
  const [currentPrice, setCurrentPrice] = useState(0)
  const [currentCandle, setCurrentCandle] = useState<CandleData | null>(null)
  
  // Trends
  const [trends, setTrends] = useState<Record<string, TrendAnalysis>>({
    "1m": { direction: "lateral", strength: 50, confidence: 0 },
    "5m": { direction: "lateral", strength: 50, confidence: 0 },
    "15m": { direction: "lateral", strength: 50, confidence: 0 },
    "1h": { direction: "lateral", strength: 50, confidence: 0 },
  })
  
  const [supportResistance, setSupportResistance] = useState<SupportResistance[]>([])
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([])
  
  // AI Configuration
  const [predictionTimeframe, setPredictionTimeframe] = useState<string>("60") // seconds
  const [candlesToWait, setCandlesToWait] = useState<number>(1)
  
  // Simple AI State
  const [isSimpleAIActive, setIsSimpleAIActive] = useState(false)
  const [isSimpleAITraining, setIsSimpleAITraining] = useState(false)
  const [simpleAILives, setSimpleAILives] = useState(10)
  const [simpleAIMaxLives, setSimpleAIMaxLives] = useState(10)
  const [simpleAIPrediction, setSimpleAIPrediction] = useState<Prediction | null>(null)
  const [simpleAIHistory, setSimpleAIHistory] = useState<Prediction[]>([])
  const [simpleAIGeneration, setSimpleAIGeneration] = useState(1)
  const [candleCount, setCandleCount] = useState(0)
  
  // Evolution State
  const [isEvolutionActive, setIsEvolutionActive] = useState(false)
  const [evolutionBrains, setEvolutionBrains] = useState<AIBrain[]>([])
  const [evolutionBrainCount, setEvolutionBrainCount] = useState(10)
  const [evolutionMaxLives, setEvolutionMaxLives] = useState(10)
  const [evolutionGeneration, setEvolutionGeneration] = useState(1)
  const [bestBrain, setBestBrain] = useState<AIBrain | null>(null)
  
  // Refs
  const tickUnsubRef = useRef<(() => void) | null>(null)
  const candle1mUnsubRef = useRef<(() => void) | null>(null)
  const candle5mUnsubRef = useRef<(() => void) | null>(null)
  const simpleNNRef = useRef<NeuralNetwork>(new NeuralNetwork())
  const pendingCandleRef = useRef<{ open: number; time: number } | null>(null)
  
  const syntheticAssets = assets.filter(
    (asset) => asset.market === "synthetic_index" || asset.submarket === "random_index"
  )
  
  // Calculate trend
  const calculateTrend = useCallback((candles: OHLCCandle[]): TrendAnalysis => {
    if (candles.length < 5) {
      return { direction: "lateral", strength: 50, confidence: 0 }
    }
    
    const closes = candles.map(c => c.close)
    const firstHalf = closes.slice(0, Math.floor(closes.length / 2))
    const secondHalf = closes.slice(Math.floor(closes.length / 2))
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100
    
    let direction: "up" | "down" | "lateral" = "lateral"
    if (change > 0.05) direction = "up"
    else if (change < -0.05) direction = "down"
    
    let upMoves = 0, downMoves = 0
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i-1]) upMoves++
      else if (closes[i] < closes[i-1]) downMoves++
    }
    
    const consistency = Math.abs(upMoves - downMoves) / (closes.length - 1)
    const strength = Math.min(100, Math.abs(change) * 20 + consistency * 50)
    const confidence = Math.min(100, candles.length * 3)
    
    return { direction, strength, confidence }
  }, [])
  
  // Calculate indicators
  const calculateIndicators = useCallback((tickData: TickData[], candleData: OHLCCandle[]) => {
    if (tickData.length < 14) return
    
    const prices = tickData.map(t => t.price)
    const newIndicators: TechnicalIndicator[] = []
    
    // RSI
    let gains = 0, losses = 0
    for (let i = prices.length - 14; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1]
      if (change > 0) gains += change
      else losses -= change
    }
    const avgGain = gains / 14
    const avgLoss = losses / 14
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const rsi = 100 - (100 / (1 + rs))
    
    newIndicators.push({
      name: "RSI (14)",
      value: rsi,
      signal: rsi > 70 ? "sell" : rsi < 30 ? "buy" : "neutral",
      description: rsi > 70 ? "Sobrecomprado" : rsi < 30 ? "Sobrevendido" : "Neutro",
    })
    
    // MAs
    const ma7 = prices.slice(-7).reduce((a, b) => a + b, 0) / 7
    const ma14 = prices.slice(-14).reduce((a, b) => a + b, 0) / 14
    const current = prices[prices.length - 1]
    
    newIndicators.push({
      name: "MA7",
      value: ma7,
      signal: current > ma7 ? "buy" : "sell",
      description: current > ma7 ? "Preco acima da media" : "Preco abaixo da media",
    })
    
    newIndicators.push({
      name: "MA14",
      value: ma14,
      signal: current > ma14 ? "buy" : "sell",
      description: current > ma14 ? "Tendencia de alta" : "Tendencia de baixa",
    })
    
    // MACD
    const ma5 = prices.slice(-5).reduce((a, b) => a + b, 0) / 5
    const ma10 = prices.slice(-10).reduce((a, b) => a + b, 0) / 10
    const macd = ma5 - ma10
    
    newIndicators.push({
      name: "MACD",
      value: macd,
      signal: macd > 0 ? "buy" : "sell",
      description: macd > 0 ? "Momentum positivo" : "Momentum negativo",
    })
    
    // Volatility
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length
    const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length
    const volatility = (Math.sqrt(variance) / mean) * 100
    
    newIndicators.push({
      name: "Volatilidade",
      value: volatility,
      signal: "neutral",
      description: volatility > 1 ? "Alta" : volatility > 0.5 ? "Media" : "Baixa",
    })
    
    setIndicators(newIndicators)
    
    // Support/Resistance
    if (candleData.length >= 20) {
      const levels: SupportResistance[] = []
      const highs = candleData.map(c => c.high)
      const lows = candleData.map(c => c.low)
      
      for (let i = 2; i < highs.length - 2; i++) {
        if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && 
            highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
          const existing = levels.find(l => Math.abs(l.price - highs[i]) / highs[i] < 0.001)
          if (existing) existing.strength++
          else levels.push({ type: "resistance", price: highs[i], strength: 1, active: highs[i] > current })
        }
      }
      
      for (let i = 2; i < lows.length - 2; i++) {
        if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && 
            lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
          const existing = levels.find(l => Math.abs(l.price - lows[i]) / lows[i] < 0.001)
          if (existing) existing.strength++
          else levels.push({ type: "support", price: lows[i], strength: 1, active: lows[i] < current })
        }
      }
      
      levels.sort((a, b) => b.strength - a.strength)
      setSupportResistance(levels.slice(0, 6))
    }
  }, [])
  
  // Load data when asset changes
  useEffect(() => {
    if (!selectedAsset || !isConnected) return
    
    // Cleanup
    if (tickUnsubRef.current) tickUnsubRef.current()
    if (candle1mUnsubRef.current) candle1mUnsubRef.current()
    if (candle5mUnsubRef.current) candle5mUnsubRef.current()
    
    const loadData = async () => {
      try {
        const tickHistory = await getTicksHistory(selectedAsset, 100) as TickData[]
        const c1m = await getTicksHistory(selectedAsset, 50, 60) as OHLCCandle[]
        const c5m = await getTicksHistory(selectedAsset, 50, 300) as OHLCCandle[]
        const c15m = await getTicksHistory(selectedAsset, 30, 900) as OHLCCandle[]
        const c1h = await getTicksHistory(selectedAsset, 30, 3600) as OHLCCandle[]
        
        setTicks(tickHistory)
        setCandles1m(c1m)
        setCandles5m(c5m)
        setCandles15m(c15m)
        setCandles1h(c1h)
        
        if (tickHistory.length > 0) {
          setCurrentPrice(tickHistory[tickHistory.length - 1].price)
          calculateIndicators(tickHistory, c1m)
        }
        
        if (c1m.length > 0) {
          const last = c1m[c1m.length - 1]
          setCurrentCandle({
            time: last.time,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
            direction: last.close >= last.open ? "up" : "down"
          })
        }
        
        setTrends({
          "1m": calculateTrend(c1m),
          "5m": calculateTrend(c5m),
          "15m": calculateTrend(c15m),
          "1h": calculateTrend(c1h),
        })
        
      } catch (error) {
        console.error("Error loading data:", error)
      }
    }
    
    loadData()
    
    // Subscribe to ticks
    tickUnsubRef.current = subscribeToTicks(selectedAsset, (tick) => {
      setTicks(prev => [...prev.slice(-99), tick])
      setCurrentPrice(tick.price)
    })
    
    // Subscribe to 1m candles
    candle1mUnsubRef.current = subscribeToCandles(selectedAsset, 60, (candle) => {
      setCandles1m(prev => {
        const newCandles = [...prev.slice(-49), candle]
        setTrends(t => ({ ...t, "1m": calculateTrend(newCandles) }))
        return newCandles
      })
      
      setCurrentCandle({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        direction: candle.close >= candle.open ? "up" : "down"
      })
      
      setCandleCount(c => c + 1)
    })
    
    return () => {
      if (tickUnsubRef.current) tickUnsubRef.current()
      if (candle1mUnsubRef.current) candle1mUnsubRef.current()
      if (candle5mUnsubRef.current) candle5mUnsubRef.current()
    }
  }, [selectedAsset, isConnected, subscribeToTicks, subscribeToCandles, getTicksHistory, calculateTrend, calculateIndicators])
  
  // Simple AI Logic
  useEffect(() => {
    if (!isSimpleAIActive || !selectedAsset || ticks.length < 20) return
    if (simpleAILives <= 0) {
      // Reset and evolve
      if (isSimpleAITraining) {
        simpleNNRef.current = new NeuralNetwork(simpleNNRef.current.mutate(0.15))
        setSimpleAIGeneration(g => g + 1)
        setSimpleAILives(simpleAIMaxLives)
      } else {
        setIsSimpleAIActive(false)
      }
      return
    }
    
    // Wait for configured candles before first prediction
    if (candleCount < candlesToWait && !simpleAIPrediction) return
    
    // Check previous prediction result when new candle arrives
    if (simpleAIPrediction && simpleAIPrediction.result === "pending" && currentCandle) {
      const candleDirection = currentCandle.close >= currentCandle.open ? "CALL" : "PUT"
      const isWin = simpleAIPrediction.direction === candleDirection
      
      const completedPrediction: Prediction = {
        ...simpleAIPrediction,
        result: isWin ? "win" : "loss",
        exitPrice: currentCandle.close,
        candleOpen: currentCandle.open,
        candleClose: currentCandle.close,
      }
      
      setSimpleAIHistory(prev => [completedPrediction, ...prev.slice(0, 99)])
      
      // Update lives
      setSimpleAILives(prev => isWin ? Math.min(prev + 1, simpleAIMaxLives) : prev - 1)
      
      // Train if enabled
      if (isSimpleAITraining) {
        const features = extractFeatures(ticks, candles1m, candles5m, candles15m, candles1h, trends)
        const target = candleDirection === "CALL" ? 0.9 : 0.1
        simpleNNRef.current.train(features, target, 0.02)
      }
      
      // Make new prediction
      const features = extractFeatures(ticks, candles1m, candles5m, candles15m, candles1h, trends)
      const output = simpleNNRef.current.predict(features)
      const direction: "CALL" | "PUT" = output > 0.5 ? "CALL" : "PUT"
      const confidence = Math.abs(output - 0.5) * 200
      
      setSimpleAIPrediction({
        id: `simple_${Date.now()}`,
        timestamp: Date.now(),
        direction,
        confidence,
        entryPrice: currentPrice,
        result: "pending",
      })
    } else if (!simpleAIPrediction) {
      // Initial prediction
      const features = extractFeatures(ticks, candles1m, candles5m, candles15m, candles1h, trends)
      const output = simpleNNRef.current.predict(features)
      const direction: "CALL" | "PUT" = output > 0.5 ? "CALL" : "PUT"
      const confidence = Math.abs(output - 0.5) * 200
      
      setSimpleAIPrediction({
        id: `simple_${Date.now()}`,
        timestamp: Date.now(),
        direction,
        confidence,
        entryPrice: currentPrice,
        result: "pending",
      })
    }
  }, [isSimpleAIActive, selectedAsset, ticks, currentCandle, simpleAIPrediction, candleCount, candlesToWait, simpleAILives, simpleAIMaxLives, isSimpleAITraining, candles1m, candles5m, candles15m, candles1h, trends, currentPrice])
  
  // Evolution Logic
  useEffect(() => {
    if (!isEvolutionActive || !selectedAsset || ticks.length < 20) return
    
    // Initialize brains
    if (evolutionBrains.length === 0) {
      const initialBrains: AIBrain[] = []
      for (let i = 0; i < evolutionBrainCount; i++) {
        const nn = new NeuralNetwork()
        initialBrains.push({
          id: `brain_${i}`,
          name: `Robo ${i + 1}`,
          generation: 1,
          lives: evolutionMaxLives,
          maxLives: evolutionMaxLives,
          wins: 0,
          losses: 0,
          accuracy: 0,
          weights: nn.weights,
          isActive: true,
          currentPrediction: null,
        })
      }
      setEvolutionBrains(initialBrains)
      return
    }
    
    // Check results and make new predictions on candle close
    if (currentCandle) {
      const candleDirection: "up" | "down" = currentCandle.close >= currentCandle.open ? "up" : "down"
      
      setEvolutionBrains(prevBrains => {
        let updatedBrains = prevBrains.map(brain => {
          if (!brain.isActive) return brain
          
          // Check previous prediction
          if (brain.currentPrediction && brain.currentPrediction.result === "pending") {
            const predictedDir = brain.currentPrediction.direction === "CALL" ? "up" : "down"
            const isWin = predictedDir === candleDirection
            
            const newLives = isWin ? Math.min(brain.lives + 1, brain.maxLives) : brain.lives - 1
            const newWins = isWin ? brain.wins + 1 : brain.wins
            const newLosses = isWin ? brain.losses : brain.losses + 1
            const newAccuracy = newWins + newLosses > 0 ? (newWins / (newWins + newLosses)) * 100 : 0
            
            return {
              ...brain,
              lives: newLives,
              wins: newWins,
              losses: newLosses,
              accuracy: newAccuracy,
              isActive: newLives > 0,
              currentPrediction: null,
              lastCandleDirection: candleDirection,
            }
          }
          
          return brain
        })
        
        // Make new predictions for active brains
        const features = extractFeatures(ticks, candles1m, candles5m, candles15m, candles1h, trends)
        
        updatedBrains = updatedBrains.map(brain => {
          if (!brain.isActive || brain.currentPrediction) return brain
          
          const nn = new NeuralNetwork(brain.weights)
          const output = nn.predict(features)
          const direction: "CALL" | "PUT" = output > 0.5 ? "CALL" : "PUT"
          const confidence = Math.abs(output - 0.5) * 200
          
          return {
            ...brain,
            currentPrediction: {
              id: `evo_${brain.id}_${Date.now()}`,
              timestamp: Date.now(),
              direction,
              confidence,
              entryPrice: currentPrice,
              result: "pending" as const,
            },
          }
        })
        
        // Find best brain
        const activeBrains = updatedBrains.filter(b => b.isActive)
        const sorted = [...updatedBrains].sort((a, b) => {
          const aScore = a.accuracy * Math.log(a.wins + a.losses + 1)
          const bScore = b.accuracy * Math.log(b.wins + b.losses + 1)
          return bScore - aScore
        })
        
        if (sorted[0]) setBestBrain(sorted[0])
        
        // Replace dead brains with mutations of best
        const deadCount = updatedBrains.filter(b => !b.isActive).length
        if (deadCount > 0 && sorted[0]) {
          const bestWeights = sorted[0].weights
          let newGen = evolutionGeneration
          
          updatedBrains = updatedBrains.map(brain => {
            if (brain.isActive) return brain
            
            const nn = new NeuralNetwork(bestWeights)
            const mutatedWeights = nn.mutate(0.2)
            newGen++
            
            return {
              id: `brain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: `Robo G${Math.floor(newGen / evolutionBrainCount) + 1}`,
              generation: Math.floor(newGen / evolutionBrainCount) + 1,
              lives: evolutionMaxLives,
              maxLives: evolutionMaxLives,
              wins: 0,
              losses: 0,
              accuracy: 0,
              weights: mutatedWeights,
              isActive: true,
              currentPrediction: null,
            }
          })
          
          setEvolutionGeneration(newGen)
        }
        
        return updatedBrains
      })
    }
  }, [isEvolutionActive, selectedAsset, ticks, currentCandle, evolutionBrains.length, evolutionBrainCount, evolutionMaxLives, evolutionGeneration, candles1m, candles5m, candles15m, candles1h, trends, currentPrice])
  
  // Save/Load functions
  const saveSimpleAI = useCallback(() => {
    const data = {
      weights: simpleNNRef.current.weights,
      generation: simpleAIGeneration,
      history: simpleAIHistory.slice(0, 50),
      savedAt: Date.now(),
    }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ai_simple_g${simpleAIGeneration}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [simpleAIGeneration, simpleAIHistory])
  
  const loadSimpleAI = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string)
            if (data.weights) {
              simpleNNRef.current.weights = data.weights
              setSimpleAIGeneration(data.generation || 1)
              if (data.history) setSimpleAIHistory(data.history)
            }
          } catch (error) {
            console.error("Error loading:", error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])
  
  const saveBestBrain = useCallback(() => {
    if (!bestBrain) return
    const blob = new Blob([JSON.stringify(bestBrain)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `best_brain_g${bestBrain.generation}_acc${bestBrain.accuracy.toFixed(0)}_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [bestBrain])
  
  const loadEvolutionBrain = useCallback(() => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target?.result as string) as AIBrain
            if (data.weights) {
              setEvolutionBrains(prev => {
                const newBrains = [...prev]
                if (newBrains.length > 0) {
                  newBrains[0] = {
                    ...data,
                    id: `loaded_${Date.now()}`,
                    isActive: true,
                    lives: evolutionMaxLives,
                    currentPrediction: null,
                  }
                }
                return newBrains
              })
            }
          } catch (error) {
            console.error("Error loading:", error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [evolutionMaxLives])
  
  // Stats
  const simpleAIStats = {
    total: simpleAIHistory.length,
    wins: simpleAIHistory.filter(p => p.result === "win").length,
    losses: simpleAIHistory.filter(p => p.result === "loss").length,
    accuracy: simpleAIHistory.length > 0 
      ? (simpleAIHistory.filter(p => p.result === "win").length / simpleAIHistory.length) * 100 
      : 0,
  }
  
  const selectedAssetInfo = assets.find(a => a.symbol === selectedAsset)
  
  return (
    <AppLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Analise com IA
            </h1>
            <p className="text-muted-foreground">
              Analise tecnica e previsao com inteligencia artificial
            </p>
          </div>
          
          <Select value={selectedAsset} onValueChange={setSelectedAsset}>
            <SelectTrigger className="w-[200px] bg-card border-border">
              <SelectValue placeholder="Selecione o ativo" />
            </SelectTrigger>
            <SelectContent>
              {syntheticAssets.map((asset) => (
                <SelectItem key={asset.symbol} value={asset.symbol}>
                  {asset.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {!selectedAsset ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Target className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Selecione um Ativo</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Escolha um ativo sintetico para iniciar a analise
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Current Candle Display */}
            <Card className="bg-card border-border">
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <CandlestickChart className="h-6 w-6 text-primary" />
                      <span className="font-medium text-foreground">Vela Atual (1m)</span>
                    </div>
                    {currentCandle && (
                      <div className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg",
                        currentCandle.direction === "up" ? "bg-success/20" : "bg-destructive/20"
                      )}>
                        {currentCandle.direction === "up" ? (
                          <ArrowUp className="h-5 w-5 text-success" />
                        ) : (
                          <ArrowDown className="h-5 w-5 text-destructive" />
                        )}
                        <span className={cn(
                          "text-lg font-bold",
                          currentCandle.direction === "up" ? "text-success" : "text-destructive"
                        )}>
                          {currentCandle.direction === "up" ? "ALTA" : "BAIXA"}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Abertura:</span>
                      <span className="ml-2 font-mono text-foreground">{currentCandle?.open.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Atual:</span>
                      <span className="ml-2 font-mono text-foreground font-bold">{currentPrice.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max:</span>
                      <span className="ml-2 font-mono text-success">{currentCandle?.high.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Min:</span>
                      <span className="ml-2 font-mono text-destructive">{currentCandle?.low.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Tabs */}
            <Tabs defaultValue="analysis" className="space-y-4">
              <TabsList className="bg-secondary grid w-full grid-cols-3">
                <TabsTrigger value="analysis">Analise Tecnica</TabsTrigger>
                <TabsTrigger value="simple">IA Simples</TabsTrigger>
                <TabsTrigger value="evolution">Evolucao Genetica</TabsTrigger>
              </TabsList>
              
              {/* Analysis Tab */}
              <TabsContent value="analysis" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Trends */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Tendencias por Periodo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries(trends).map(([period, trend]) => (
                        <div key={period} className="p-3 rounded-lg bg-secondary/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-foreground">{period}</span>
                            <Badge
                              className={cn(
                                trend.direction === "up" && "bg-success text-success-foreground",
                                trend.direction === "down" && "bg-destructive text-destructive-foreground",
                                trend.direction === "lateral" && "bg-secondary text-secondary-foreground"
                              )}
                            >
                              {trend.direction === "up" && <ArrowUp className="h-3 w-3 mr-1" />}
                              {trend.direction === "down" && <ArrowDown className="h-3 w-3 mr-1" />}
                              {trend.direction === "lateral" && <Minus className="h-3 w-3 mr-1" />}
                              {trend.direction === "up" ? "Alta" : trend.direction === "down" ? "Baixa" : "Lateral"}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-14">Forca</span>
                              <Progress value={trend.strength} className="flex-1 h-1.5" />
                              <span className="text-xs text-muted-foreground w-8">{trend.strength.toFixed(0)}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-14">Confianca</span>
                              <Progress value={trend.confidence} className="flex-1 h-1.5" />
                              <span className="text-xs text-muted-foreground w-8">{trend.confidence.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  
                  {/* Indicators */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Indicadores Tecnicos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {indicators.map((ind) => (
                          <div key={ind.name} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                            <div>
                              <p className="font-medium text-sm text-foreground">{ind.name}</p>
                              <p className="text-xs text-muted-foreground">{ind.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-sm text-foreground">{ind.value.toFixed(2)}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs",
                                  ind.signal === "buy" && "border-success text-success",
                                  ind.signal === "sell" && "border-destructive text-destructive"
                                )}
                              >
                                {ind.signal === "buy" ? "Compra" : ind.signal === "sell" ? "Venda" : "Neutro"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Support/Resistance */}
                  <Card className="bg-card border-border lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Suportes e Resistencias
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-success mb-2 text-sm">Suportes</h4>
                          <div className="space-y-1">
                            {supportResistance.filter(sr => sr.type === "support").slice(0, 3).map((level, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded bg-success/10 text-sm">
                                <span className="font-mono text-success">{level.price.toFixed(2)}</span>
                                <span className="text-xs text-muted-foreground">Forca: {level.strength}</span>
                              </div>
                            ))}
                            {supportResistance.filter(sr => sr.type === "support").length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhum identificado</p>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium text-destructive mb-2 text-sm">Resistencias</h4>
                          <div className="space-y-1">
                            {supportResistance.filter(sr => sr.type === "resistance").slice(0, 3).map((level, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/10 text-sm">
                                <span className="font-mono text-destructive">{level.price.toFixed(2)}</span>
                                <span className="text-xs text-muted-foreground">Forca: {level.strength}</span>
                              </div>
                            ))}
                            {supportResistance.filter(sr => sr.type === "resistance").length === 0 && (
                              <p className="text-xs text-muted-foreground">Nenhum identificado</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              {/* Simple AI Tab */}
              <TabsContent value="simple" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Config */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-primary" />
                        Configuracao
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Vidas Maximas</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[simpleAIMaxLives]}
                            onValueChange={([v]) => setSimpleAIMaxLives(v)}
                            min={1}
                            max={50}
                            step={1}
                            disabled={isSimpleAIActive}
                            className="flex-1"
                          />
                          <span className="w-8 text-sm font-mono">{simpleAIMaxLives}</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Velas para primeira decisao</Label>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[candlesToWait]}
                            onValueChange={([v]) => setCandlesToWait(v)}
                            min={1}
                            max={10}
                            step={1}
                            disabled={isSimpleAIActive}
                            className="flex-1"
                          />
                          <span className="w-8 text-sm font-mono">{candlesToWait}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant={isSimpleAIActive ? "destructive" : "default"}
                          onClick={() => {
                            if (!isSimpleAIActive) {
                              setSimpleAILives(simpleAIMaxLives)
                              setCandleCount(0)
                              setSimpleAIPrediction(null)
                            }
                            setIsSimpleAIActive(!isSimpleAIActive)
                          }}
                        >
                          {isSimpleAIActive ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                          {isSimpleAIActive ? "Parar" : "Iniciar"}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant={isSimpleAITraining ? "secondary" : "outline"}
                          onClick={() => setIsSimpleAITraining(!isSimpleAITraining)}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          {isSimpleAITraining ? "Treinando" : "Treinar"}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            simpleNNRef.current = new NeuralNetwork()
                            setSimpleAIGeneration(1)
                            setSimpleAIHistory([])
                            setSimpleAIPrediction(null)
                            setSimpleAILives(simpleAIMaxLives)
                          }}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                      </div>
                      
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button size="sm" variant="outline" onClick={saveSimpleAI} className="flex-1">
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={loadSimpleAI} className="flex-1">
                          <Upload className="h-4 w-4 mr-1" />
                          Carregar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Current Prediction */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Brain className="h-4 w-4 text-primary" />
                        Previsao da IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Geracao:</span>
                          <Badge variant="secondary">{simpleAIGeneration}</Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: simpleAIMaxLives }).map((_, i) => (
                            <Heart
                              key={i}
                              className={cn(
                                "h-4 w-4",
                                i < simpleAILives ? "text-destructive fill-destructive" : "text-muted-foreground"
                              )}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {simpleAIPrediction ? (
                        <div className={cn(
                          "p-4 rounded-lg text-center",
                          simpleAIPrediction.direction === "CALL" ? "bg-success/20" : "bg-destructive/20"
                        )}>
                          <div className="text-xs text-muted-foreground mb-1">Proxima vela sera</div>
                          <div className={cn(
                            "text-3xl font-bold flex items-center justify-center gap-2",
                            simpleAIPrediction.direction === "CALL" ? "text-success" : "text-destructive"
                          )}>
                            {simpleAIPrediction.direction === "CALL" ? (
                              <ArrowUp className="h-8 w-8" />
                            ) : (
                              <ArrowDown className="h-8 w-8" />
                            )}
                            {simpleAIPrediction.direction === "CALL" ? "ALTA" : "BAIXA"}
                          </div>
                          <div className="text-sm text-muted-foreground mt-2">
                            Confianca: {simpleAIPrediction.confidence.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Entrada: {simpleAIPrediction.entryPrice.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg bg-secondary/30 text-center">
                          <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {isSimpleAIActive 
                              ? `Aguardando ${candlesToWait - candleCount} vela(s)...`
                              : "IA inativa"}
                          </p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div className="p-2 rounded bg-secondary/30">
                          <div className="text-lg font-bold text-foreground">{simpleAIStats.total}</div>
                          <div className="text-xs text-muted-foreground">Total</div>
                        </div>
                        <div className="p-2 rounded bg-success/10">
                          <div className="text-lg font-bold text-success">{simpleAIStats.wins}</div>
                          <div className="text-xs text-muted-foreground">Acertos</div>
                        </div>
                        <div className="p-2 rounded bg-destructive/10">
                          <div className="text-lg font-bold text-destructive">{simpleAIStats.losses}</div>
                          <div className="text-xs text-muted-foreground">Erros</div>
                        </div>
                      </div>
                      
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Precisao</span>
                          <span className="font-bold text-foreground">{simpleAIStats.accuracy.toFixed(1)}%</span>
                        </div>
                        <Progress value={simpleAIStats.accuracy} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* History */}
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Historico
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-2">
                          {simpleAIHistory.slice(0, 20).map((pred) => (
                            <div
                              key={pred.id}
                              className={cn(
                                "p-2 rounded text-sm flex items-center justify-between",
                                pred.result === "win" ? "bg-success/10" : "bg-destructive/10"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {pred.result === "win" ? (
                                  <CheckCircle2 className="h-4 w-4 text-success" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                <span className={pred.direction === "CALL" ? "text-success" : "text-destructive"}>
                                  {pred.direction}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {pred.entryPrice.toFixed(2)} → {pred.exitPrice?.toFixed(2)}
                              </div>
                            </div>
                          ))}
                          {simpleAIHistory.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              Nenhuma previsao ainda
                            </p>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              {/* Evolution Tab */}
              <TabsContent value="evolution" className="space-y-4">
                {/* Config Bar */}
                <Card className="bg-card border-border">
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Quantidade de IAs</Label>
                        <Input
                          type="number"
                          value={evolutionBrainCount}
                          onChange={(e) => setEvolutionBrainCount(Math.max(2, Math.min(20, parseInt(e.target.value) || 10)))}
                          disabled={isEvolutionActive}
                          className="w-20 h-8"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <Label className="text-xs">Vidas por IA</Label>
                        <Input
                          type="number"
                          value={evolutionMaxLives}
                          onChange={(e) => setEvolutionMaxLives(Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                          disabled={isEvolutionActive}
                          className="w-20 h-8"
                        />
                      </div>
                      
                      <Button
                        size="sm"
                        variant={isEvolutionActive ? "destructive" : "default"}
                        onClick={() => {
                          if (!isEvolutionActive) {
                            setEvolutionBrains([])
                            setEvolutionGeneration(1)
                            setBestBrain(null)
                          }
                          setIsEvolutionActive(!isEvolutionActive)
                        }}
                      >
                        {isEvolutionActive ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                        {isEvolutionActive ? "Parar" : "Iniciar"}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEvolutionBrains([])
                          setEvolutionGeneration(1)
                          setBestBrain(null)
                          setIsEvolutionActive(false)
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Reset
                      </Button>
                      
                      <div className="flex gap-2 ml-auto">
                        <Button size="sm" variant="outline" onClick={saveBestBrain} disabled={!bestBrain}>
                          <Save className="h-4 w-4 mr-1" />
                          Salvar Melhor
                        </Button>
                        <Button size="sm" variant="outline" onClick={loadEvolutionBrain}>
                          <Upload className="h-4 w-4 mr-1" />
                          Carregar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4 text-center">
                      <Dna className="h-6 w-6 text-primary mx-auto mb-1" />
                      <div className="text-2xl font-bold text-foreground">{evolutionGeneration}</div>
                      <div className="text-xs text-muted-foreground">Geracao</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4 text-center">
                      <Brain className="h-6 w-6 text-primary mx-auto mb-1" />
                      <div className="text-2xl font-bold text-foreground">
                        {evolutionBrains.filter(b => b.isActive).length}
                      </div>
                      <div className="text-xs text-muted-foreground">IAs Ativas</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4 text-center">
                      <Crown className="h-6 w-6 text-yellow-500 mx-auto mb-1" />
                      <div className="text-2xl font-bold text-foreground">
                        {bestBrain?.accuracy.toFixed(1) || 0}%
                      </div>
                      <div className="text-xs text-muted-foreground">Melhor Precisao</div>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4 text-center">
                      <Target className="h-6 w-6 text-primary mx-auto mb-1" />
                      <div className="text-2xl font-bold text-foreground">
                        {bestBrain ? bestBrain.wins + bestBrain.losses : 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Operacoes</div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Brains Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {evolutionBrains.map((brain) => (
                    <Card
                      key={brain.id}
                      className={cn(
                        "bg-card border-border transition-all",
                        !brain.isActive && "opacity-50",
                        bestBrain?.id === brain.id && "ring-2 ring-yellow-500"
                      )}
                    >
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground truncate">
                            {brain.name}
                          </span>
                          {bestBrain?.id === brain.id && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                          {!brain.isActive && (
                            <Skull className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-0.5 mb-2">
                          {Array.from({ length: brain.maxLives }).map((_, i) => (
                            <Heart
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < brain.lives ? "text-destructive fill-destructive" : "text-muted-foreground/30"
                              )}
                            />
                          ))}
                        </div>
                        
                        {brain.currentPrediction && (
                          <div className={cn(
                            "p-1.5 rounded text-center mb-2",
                            brain.currentPrediction.direction === "CALL" ? "bg-success/20" : "bg-destructive/20"
                          )}>
                            <div className={cn(
                              "text-sm font-bold flex items-center justify-center gap-1",
                              brain.currentPrediction.direction === "CALL" ? "text-success" : "text-destructive"
                            )}>
                              {brain.currentPrediction.direction === "CALL" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {brain.currentPrediction.direction === "CALL" ? "ALTA" : "BAIXA"}
                            </div>
                          </div>
                        )}
                        
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className="text-center p-1 rounded bg-success/10">
                            <div className="font-bold text-success">{brain.wins}</div>
                            <div className="text-muted-foreground">Win</div>
                          </div>
                          <div className="text-center p-1 rounded bg-destructive/10">
                            <div className="font-bold text-destructive">{brain.losses}</div>
                            <div className="text-muted-foreground">Loss</div>
                          </div>
                        </div>
                        
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span className="text-muted-foreground">Precisao</span>
                            <span className="font-bold">{brain.accuracy.toFixed(1)}%</span>
                          </div>
                          <Progress value={brain.accuracy} className="h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {evolutionBrains.length === 0 && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Clique em Iniciar para comecar a evolucao
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  )
}
