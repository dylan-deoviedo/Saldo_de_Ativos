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
  Zap,
  Heart,
  Crown,
  Skull,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Sparkles,
  Dna,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types for AI Analysis
interface TrendAnalysis {
  direction: "up" | "down" | "lateral"
  strength: number // 0-100
  confidence: number // 0-100
}

interface SupportResistance {
  type: "support" | "resistance"
  price: number
  strength: number // how many times tested
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
}

interface AIBrain {
  id: string
  name: string
  generation: number
  lives: number
  maxLives: number
  predictions: Prediction[]
  wins: number
  losses: number
  accuracy: number
  weights: number[] // Neural network weights
  isActive: boolean
  createdAt: number
  parentId?: string
}

interface MarketData {
  ticks: TickData[]
  candles: OHLCCandle[]
  currentPrice: number
  highPrice: number
  lowPrice: number
  openPrice: number
  volume: number
}

// Simple neural network implementation
class NeuralNetwork {
  weights: number[]
  
  constructor(weights?: number[]) {
    // 20 inputs (price features) -> 10 hidden -> 1 output
    this.weights = weights || this.initializeWeights()
  }
  
  initializeWeights(): number[] {
    const weights: number[] = []
    // Input to hidden: 20 * 10 = 200
    // Hidden to output: 10 * 1 = 10
    // Biases: 10 + 1 = 11
    for (let i = 0; i < 221; i++) {
      weights.push(Math.random() * 2 - 1)
    }
    return weights
  }
  
  sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))))
  }
  
  predict(inputs: number[]): number {
    // Normalize inputs
    const normalizedInputs = inputs.slice(0, 20)
    while (normalizedInputs.length < 20) {
      normalizedInputs.push(0)
    }
    
    // Input to hidden layer
    const hidden: number[] = []
    for (let i = 0; i < 10; i++) {
      let sum = this.weights[200 + i] // bias
      for (let j = 0; j < 20; j++) {
        sum += normalizedInputs[j] * this.weights[i * 20 + j]
      }
      hidden.push(this.sigmoid(sum))
    }
    
    // Hidden to output
    let output = this.weights[220] // bias
    for (let i = 0; i < 10; i++) {
      output += hidden[i] * this.weights[210 + i]
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
  
  crossover(other: number[]): number[] {
    return this.weights.map((w, i) => 
      Math.random() < 0.5 ? w : other[i]
    )
  }
}

// Extract features from market data
function extractFeatures(ticks: TickData[], candles: OHLCCandle[]): number[] {
  const features: number[] = []
  
  if (ticks.length < 10) {
    return Array(20).fill(0)
  }
  
  const recentTicks = ticks.slice(-20)
  const prices = recentTicks.map(t => t.price)
  
  // Price momentum (last 5 vs previous 5)
  const recent5 = prices.slice(-5)
  const prev5 = prices.slice(-10, -5)
  const recentAvg = recent5.reduce((a, b) => a + b, 0) / 5
  const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / 5 : recentAvg
  features.push((recentAvg - prevAvg) / prevAvg * 100) // Momentum
  
  // Price changes
  for (let i = 1; i <= 10 && i < prices.length; i++) {
    const change = (prices[prices.length - i] - prices[prices.length - i - 1]) / prices[prices.length - i - 1] * 100
    features.push(change)
  }
  while (features.length < 11) features.push(0)
  
  // Volatility
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length
  const variance = prices.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / prices.length
  features.push(Math.sqrt(variance) / mean * 100)
  
  // RSI-like
  let gains = 0, losses = 0
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }
  const rsi = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses))
  features.push(rsi / 100)
  
  // Trend direction
  const firstHalf = prices.slice(0, Math.floor(prices.length / 2))
  const secondHalf = prices.slice(Math.floor(prices.length / 2))
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
  features.push((secondAvg - firstAvg) / firstAvg * 100)
  
  // Candle patterns (if available)
  if (candles.length >= 3) {
    const lastCandle = candles[candles.length - 1]
    const prevCandle = candles[candles.length - 2]
    
    // Candle body size
    features.push((lastCandle.close - lastCandle.open) / lastCandle.open * 100)
    // Upper shadow
    features.push((lastCandle.high - Math.max(lastCandle.open, lastCandle.close)) / lastCandle.open * 100)
    // Lower shadow
    features.push((Math.min(lastCandle.open, lastCandle.close) - lastCandle.low) / lastCandle.open * 100)
    // Candle direction change
    features.push(lastCandle.close > lastCandle.open ? 1 : -1)
    features.push(prevCandle.close > prevCandle.open ? 1 : -1)
  } else {
    features.push(0, 0, 0, 0, 0)
  }
  
  // Pad to 20 features
  while (features.length < 20) features.push(0)
  
  return features.slice(0, 20)
}

export default function AIAnalysisPage() {
  const { assets, isConnected, subscribeToTicks, getTicksHistory, subscribeToCandles } = useDerivContext()
  
  // State
  const [selectedAsset, setSelectedAsset] = useState<string>("")
  const [marketData, setMarketData] = useState<MarketData>({
    ticks: [],
    candles: [],
    currentPrice: 0,
    highPrice: 0,
    lowPrice: 0,
    openPrice: 0,
    volume: 0,
  })
  
  // Trend analysis state
  const [trends, setTrends] = useState<Record<string, TrendAnalysis>>({
    "1m": { direction: "lateral", strength: 50, confidence: 0 },
    "5m": { direction: "lateral", strength: 50, confidence: 0 },
    "15m": { direction: "lateral", strength: 50, confidence: 0 },
    "1h": { direction: "lateral", strength: 50, confidence: 0 },
  })
  
  const [supportResistance, setSupportResistance] = useState<SupportResistance[]>([])
  const [indicators, setIndicators] = useState<TechnicalIndicator[]>([])
  
  // AI State
  const [isAIActive, setIsAIActive] = useState(false)
  const [isTraining, setIsTraining] = useState(false)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [currentPrediction, setCurrentPrediction] = useState<Prediction | null>(null)
  
  // Evolution Mode
  const [isEvolutionMode, setIsEvolutionMode] = useState(false)
  const [brains, setBrains] = useState<AIBrain[]>([])
  const [bestBrain, setBestBrain] = useState<AIBrain | null>(null)
  const [generation, setGeneration] = useState(1)
  
  // Refs
  const tickUnsubscribeRef = useRef<(() => void) | null>(null)
  const candleUnsubscribeRef = useRef<(() => void) | null>(null)
  const neuralNetworkRef = useRef<NeuralNetwork>(new NeuralNetwork())
  const predictionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Filter synthetic assets
  const syntheticAssets = assets.filter(
    (asset) => asset.market === "synthetic_index" || asset.submarket === "random_index"
  )
  
  // Calculate technical indicators
  const calculateIndicators = useCallback((ticks: TickData[], candles: OHLCCandle[]) => {
    if (ticks.length < 14) return
    
    const prices = ticks.map(t => t.price)
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
    
    // Moving Averages
    const ma7 = prices.slice(-7).reduce((a, b) => a + b, 0) / 7
    const ma14 = prices.slice(-14).reduce((a, b) => a + b, 0) / 14
    const currentPrice = prices[prices.length - 1]
    
    newIndicators.push({
      name: "MA7",
      value: ma7,
      signal: currentPrice > ma7 ? "buy" : "sell",
      description: currentPrice > ma7 ? "Preco acima da media" : "Preco abaixo da media",
    })
    
    newIndicators.push({
      name: "MA14",
      value: ma14,
      signal: currentPrice > ma14 ? "buy" : "sell",
      description: currentPrice > ma14 ? "Tendencia de alta" : "Tendencia de baixa",
    })
    
    // MACD-like
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
      description: volatility > 1 ? "Alta volatilidade" : volatility > 0.5 ? "Media volatilidade" : "Baixa volatilidade",
    })
    
    setIndicators(newIndicators)
    
    // Calculate support/resistance levels
    if (candles.length >= 20) {
      const levels: SupportResistance[] = []
      const highs = candles.map(c => c.high)
      const lows = candles.map(c => c.low)
      
      // Find resistance levels (local maxima)
      for (let i = 2; i < highs.length - 2; i++) {
        if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && 
            highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
          const existing = levels.find(l => Math.abs(l.price - highs[i]) / highs[i] < 0.001)
          if (existing) {
            existing.strength++
          } else {
            levels.push({
              type: "resistance",
              price: highs[i],
              strength: 1,
              active: highs[i] > currentPrice,
            })
          }
        }
      }
      
      // Find support levels (local minima)
      for (let i = 2; i < lows.length - 2; i++) {
        if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && 
            lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
          const existing = levels.find(l => Math.abs(l.price - lows[i]) / lows[i] < 0.001)
          if (existing) {
            existing.strength++
          } else {
            levels.push({
              type: "support",
              price: lows[i],
              strength: 1,
              active: lows[i] < currentPrice,
            })
          }
        }
      }
      
      // Sort by strength and take top 6
      levels.sort((a, b) => b.strength - a.strength)
      setSupportResistance(levels.slice(0, 6))
    }
  }, [])
  
  // Calculate trend for a timeframe
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
    if (change > 0.1) direction = "up"
    else if (change < -0.1) direction = "down"
    
    // Calculate strength based on consistency
    let upMoves = 0, downMoves = 0
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i-1]) upMoves++
      else if (closes[i] < closes[i-1]) downMoves++
    }
    
    const consistency = Math.abs(upMoves - downMoves) / (closes.length - 1)
    const strength = Math.min(100, Math.abs(change) * 10 + consistency * 50)
    const confidence = Math.min(100, candles.length * 5)
    
    return { direction, strength, confidence }
  }, [])
  
  // Load historical data when asset changes
  useEffect(() => {
    if (!selectedAsset || !isConnected) return
    
    // Unsubscribe from previous
    if (tickUnsubscribeRef.current) {
      tickUnsubscribeRef.current()
    }
    if (candleUnsubscribeRef.current) {
      candleUnsubscribeRef.current()
    }
    
    // Load historical data for multiple timeframes
    const loadData = async () => {
      try {
        // Get tick history
        const tickHistory = await getTicksHistory(selectedAsset, 100) as TickData[]
        
        // Get candle history for different timeframes
        const candles1m = await getTicksHistory(selectedAsset, 50, 60) as OHLCCandle[]
        const candles5m = await getTicksHistory(selectedAsset, 50, 300) as OHLCCandle[]
        const candles15m = await getTicksHistory(selectedAsset, 50, 900) as OHLCCandle[]
        const candles1h = await getTicksHistory(selectedAsset, 50, 3600) as OHLCCandle[]
        
        if (tickHistory.length > 0) {
          const prices = tickHistory.map(t => t.price)
          setMarketData({
            ticks: tickHistory,
            candles: candles1m,
            currentPrice: prices[prices.length - 1],
            highPrice: Math.max(...prices),
            lowPrice: Math.min(...prices),
            openPrice: prices[0],
            volume: tickHistory.length,
          })
          
          calculateIndicators(tickHistory, candles1m)
        }
        
        // Calculate trends for each timeframe
        setTrends({
          "1m": calculateTrend(candles1m),
          "5m": calculateTrend(candles5m),
          "15m": calculateTrend(candles15m),
          "1h": calculateTrend(candles1h),
        })
        
      } catch (error) {
        console.error("Error loading market data:", error)
      }
    }
    
    loadData()
    
    // Subscribe to live ticks
    tickUnsubscribeRef.current = subscribeToTicks(selectedAsset, (tick) => {
      setMarketData(prev => {
        const newTicks = [...prev.ticks.slice(-99), tick]
        const prices = newTicks.map(t => t.price)
        
        return {
          ...prev,
          ticks: newTicks,
          currentPrice: tick.price,
          highPrice: Math.max(prev.highPrice, tick.price),
          lowPrice: Math.min(prev.lowPrice, tick.price),
        }
      })
    })
    
    // Subscribe to candles
    candleUnsubscribeRef.current = subscribeToCandles(selectedAsset, 60, (candle) => {
      setMarketData(prev => {
        const newCandles = [...prev.candles.slice(-49), candle]
        calculateIndicators(prev.ticks, newCandles)
        setTrends(t => ({
          ...t,
          "1m": calculateTrend(newCandles),
        }))
        return {
          ...prev,
          candles: newCandles,
        }
      })
    })
    
    return () => {
      if (tickUnsubscribeRef.current) {
        tickUnsubscribeRef.current()
      }
      if (candleUnsubscribeRef.current) {
        candleUnsubscribeRef.current()
      }
    }
  }, [selectedAsset, isConnected, subscribeToTicks, subscribeToCandles, getTicksHistory, calculateIndicators, calculateTrend])
  
  // AI Prediction logic
  const makePrediction = useCallback(() => {
    if (marketData.ticks.length < 20) return null
    
    const features = extractFeatures(marketData.ticks, marketData.candles)
    const output = neuralNetworkRef.current.predict(features)
    
    const direction: "CALL" | "PUT" = output > 0.5 ? "CALL" : "PUT"
    const confidence = Math.abs(output - 0.5) * 200 // 0-100
    
    const prediction: Prediction = {
      id: `pred_${Date.now()}`,
      timestamp: Date.now(),
      direction,
      confidence,
      entryPrice: marketData.currentPrice,
      result: "pending",
    }
    
    return prediction
  }, [marketData])
  
  // Check prediction result
  const checkPrediction = useCallback((prediction: Prediction, currentPrice: number): "win" | "loss" => {
    const priceChange = currentPrice - prediction.entryPrice
    
    if (prediction.direction === "CALL") {
      return priceChange > 0 ? "win" : "loss"
    } else {
      return priceChange < 0 ? "win" : "loss"
    }
  }, [])
  
  // AI Analysis loop
  useEffect(() => {
    if (!isAIActive || !selectedAsset || marketData.ticks.length < 20) return
    
    const analyzeInterval = setInterval(() => {
      const prediction = makePrediction()
      if (prediction) {
        setCurrentPrediction(prediction)
        
        // Check result after 5 seconds (simulating tick duration)
        if (predictionTimeoutRef.current) {
          clearTimeout(predictionTimeoutRef.current)
        }
        
        predictionTimeoutRef.current = setTimeout(() => {
          setCurrentPrediction(prev => {
            if (!prev) return null
            
            const result = checkPrediction(prev, marketData.currentPrice)
            const completedPrediction = {
              ...prev,
              result,
              exitPrice: marketData.currentPrice,
            }
            
            setPredictions(p => [completedPrediction, ...p.slice(0, 99)])
            
            // Update neural network through training
            if (isTraining) {
              const features = extractFeatures(marketData.ticks, marketData.candles)
              const target = result === "win" ? (prev.direction === "CALL" ? 0.9 : 0.1) : (prev.direction === "CALL" ? 0.1 : 0.9)
              // Simple weight adjustment
              neuralNetworkRef.current.weights = neuralNetworkRef.current.weights.map((w, i) => {
                const adjustment = (target - neuralNetworkRef.current.predict(features)) * 0.01 * features[i % 20]
                return w + adjustment
              })
            }
            
            return null
          })
        }, 5000)
      }
    }, 3000)
    
    return () => {
      clearInterval(analyzeInterval)
      if (predictionTimeoutRef.current) {
        clearTimeout(predictionTimeoutRef.current)
      }
    }
  }, [isAIActive, selectedAsset, marketData, makePrediction, checkPrediction, isTraining])
  
  // Evolution mode logic
  useEffect(() => {
    if (!isEvolutionMode || !selectedAsset || marketData.ticks.length < 20) return
    
    // Initialize brains if empty
    if (brains.length === 0) {
      const initialBrains: AIBrain[] = []
      for (let i = 0; i < 10; i++) {
        const nn = new NeuralNetwork()
        initialBrains.push({
          id: `brain_${i}`,
          name: `Robo ${i + 1}`,
          generation: 1,
          lives: 10,
          maxLives: 10,
          predictions: [],
          wins: 0,
          losses: 0,
          accuracy: 0,
          weights: nn.weights,
          isActive: true,
          createdAt: Date.now(),
        })
      }
      setBrains(initialBrains)
      return
    }
    
    const evolveInterval = setInterval(() => {
      setBrains(prevBrains => {
        const features = extractFeatures(marketData.ticks, marketData.candles)
        const currentPrice = marketData.currentPrice
        
        return prevBrains.map(brain => {
          if (!brain.isActive || brain.lives <= 0) return brain
          
          const nn = new NeuralNetwork(brain.weights)
          const output = nn.predict(features)
          const direction: "CALL" | "PUT" = output > 0.5 ? "CALL" : "PUT"
          const confidence = Math.abs(output - 0.5) * 200
          
          const prediction: Prediction = {
            id: `pred_${brain.id}_${Date.now()}`,
            timestamp: Date.now(),
            direction,
            confidence,
            entryPrice: currentPrice,
            result: "pending",
          }
          
          return {
            ...brain,
            predictions: [prediction, ...brain.predictions.slice(0, 19)],
          }
        })
      })
      
      // Check results after delay
      setTimeout(() => {
        setBrains(prevBrains => {
          let updatedBrains = prevBrains.map(brain => {
            if (!brain.isActive || brain.lives <= 0) return brain
            
            const lastPrediction = brain.predictions[0]
            if (!lastPrediction || lastPrediction.result !== "pending") return brain
            
            const priceChange = marketData.currentPrice - lastPrediction.entryPrice
            const isWin = (lastPrediction.direction === "CALL" && priceChange > 0) ||
                          (lastPrediction.direction === "PUT" && priceChange < 0)
            
            const newLives = isWin ? brain.lives : brain.lives - 1
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
              predictions: brain.predictions.map((p, i) => 
                i === 0 ? { ...p, result: isWin ? "win" : "loss" as const, exitPrice: marketData.currentPrice } : p
              ),
            }
          })
          
          // Find best brain
          const activeBrains = updatedBrains.filter(b => b.isActive)
          const sortedByAccuracy = [...updatedBrains].sort((a, b) => {
            const aScore = a.accuracy * (a.wins + a.losses)
            const bScore = b.accuracy * (b.wins + b.losses)
            return bScore - aScore
          })
          
          if (sortedByAccuracy[0]) {
            setBestBrain(sortedByAccuracy[0])
          }
          
          // Replace dead brains with mutations of the best
          const deadBrains = updatedBrains.filter(b => !b.isActive)
          if (deadBrains.length > 0 && sortedByAccuracy[0]) {
            const bestWeights = sortedByAccuracy[0].weights
            
            updatedBrains = updatedBrains.map(brain => {
              if (brain.isActive) return brain
              
              const nn = new NeuralNetwork(bestWeights)
              const mutatedWeights = nn.mutate(0.2)
              
              return {
                ...brain,
                id: `brain_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                name: `Robo G${generation + 1}`,
                generation: generation + 1,
                lives: 10,
                maxLives: 10,
                predictions: [],
                wins: 0,
                losses: 0,
                accuracy: 0,
                weights: mutatedWeights,
                isActive: true,
                createdAt: Date.now(),
                parentId: sortedByAccuracy[0].id,
              }
            })
            
            setGeneration(g => g + 1)
          }
          
          return updatedBrains
        })
      }, 3000)
      
    }, 5000)
    
    return () => clearInterval(evolveInterval)
  }, [isEvolutionMode, selectedAsset, marketData, brains.length, generation])
  
  // Save/Load functions
  const saveBrain = useCallback(() => {
    const data = {
      weights: neuralNetworkRef.current.weights,
      predictions: predictions.slice(0, 50),
      savedAt: Date.now(),
    }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `ai_brain_${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [predictions])
  
  const loadBrain = useCallback(() => {
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
              neuralNetworkRef.current.weights = data.weights
              if (data.predictions) {
                setPredictions(data.predictions)
              }
            }
          } catch (error) {
            console.error("Error loading brain:", error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])
  
  const saveBestBrain = useCallback(() => {
    if (!bestBrain) return
    const data = {
      ...bestBrain,
      savedAt: Date.now(),
    }
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `best_brain_g${bestBrain.generation}_${Date.now()}.json`
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
              // Add loaded brain as the first brain
              setBrains(prev => {
                const newBrains = [...prev]
                newBrains[0] = {
                  ...data,
                  id: `loaded_${Date.now()}`,
                  isActive: true,
                  lives: 10,
                  predictions: [],
                }
                return newBrains
              })
            }
          } catch (error) {
            console.error("Error loading brain:", error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])
  
  // Calculate statistics
  const aiStats = {
    totalPredictions: predictions.length,
    wins: predictions.filter(p => p.result === "win").length,
    losses: predictions.filter(p => p.result === "loss").length,
    accuracy: predictions.length > 0 
      ? (predictions.filter(p => p.result === "win").length / predictions.filter(p => p.result !== "pending").length) * 100 
      : 0,
  }
  
  const selectedAssetInfo = assets.find(a => a.symbol === selectedAsset)
  
  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              Analise com IA
            </h1>
            <p className="text-muted-foreground">
              Analise tecnica avancada com inteligencia artificial
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-[200px] bg-secondary border-border">
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
        </div>
        
        {!selectedAsset ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Target className="h-16 w-16 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Selecione um Ativo</h2>
              <p className="text-muted-foreground text-center max-w-md">
                Escolha um ativo sintetico para iniciar a analise tecnica e ativar a inteligencia artificial
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Market Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-card border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Preco Atual</span>
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {marketData.currentPrice.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{selectedAssetInfo?.display_name}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-card border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Maxima</span>
                    <TrendingUp className="h-4 w-4 text-success" />
                  </div>
                  <p className="text-2xl font-bold text-success mt-1">
                    {marketData.highPrice.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-card border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Minima</span>
                    <TrendingDown className="h-4 w-4 text-destructive" />
                  </div>
                  <p className="text-2xl font-bold text-destructive mt-1">
                    {marketData.lowPrice.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
              
              <Card className="bg-card border-border">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Variacao</span>
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <p className={cn(
                    "text-2xl font-bold mt-1",
                    marketData.currentPrice >= marketData.openPrice ? "text-success" : "text-destructive"
                  )}>
                    {((marketData.currentPrice - marketData.openPrice) / marketData.openPrice * 100).toFixed(2)}%
                  </p>
                </CardContent>
              </Card>
            </div>
            
            {/* Main Content */}
            <Tabs defaultValue="analysis" className="space-y-4">
              <TabsList className="bg-secondary">
                <TabsTrigger value="analysis">Analise Tecnica</TabsTrigger>
                <TabsTrigger value="ai">IA Simples</TabsTrigger>
                <TabsTrigger value="evolution">Evolucao Genetica</TabsTrigger>
              </TabsList>
              
              {/* Analysis Tab */}
              <TabsContent value="analysis" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Trend Analysis */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Tendencias por Periodo
                      </CardTitle>
                      <CardDescription>Analise de tendencia em diferentes timeframes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(trends).map(([period, trend]) => (
                        <div key={period} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{period}</span>
                            <Badge
                              variant={trend.direction === "up" ? "default" : trend.direction === "down" ? "destructive" : "secondary"}
                              className={cn(
                                trend.direction === "up" && "bg-success text-success-foreground",
                              )}
                            >
                              {trend.direction === "up" ? "Alta" : trend.direction === "down" ? "Baixa" : "Lateral"}
                              {trend.direction === "up" ? <TrendingUp className="h-3 w-3 ml-1" /> : 
                               trend.direction === "down" ? <TrendingDown className="h-3 w-3 ml-1" /> : null}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16">Forca:</span>
                            <Progress value={trend.strength} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground w-10">{trend.strength.toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16">Confianca:</span>
                            <Progress value={trend.confidence} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground w-10">{trend.confidence.toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  
                  {/* Technical Indicators */}
                  <Card className="bg-card border-border">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" />
                        Indicadores Tecnicos
                      </CardTitle>
                      <CardDescription>Principais indicadores de mercado</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {indicators.map((indicator) => (
                          <div key={indicator.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                            <div>
                              <p className="font-medium text-foreground">{indicator.name}</p>
                              <p className="text-xs text-muted-foreground">{indicator.description}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-foreground">{indicator.value.toFixed(2)}</p>
                              <Badge
                                variant={indicator.signal === "buy" ? "default" : indicator.signal === "sell" ? "destructive" : "secondary"}
                                className={cn(
                                  "text-xs",
                                  indicator.signal === "buy" && "bg-success text-success-foreground"
                                )}
                              >
                                {indicator.signal === "buy" ? "Compra" : indicator.signal === "sell" ? "Venda" : "Neutro"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Support/Resistance */}
                  <Card className="bg-card border-border lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Suportes e Resistencias
                      </CardTitle>
                      <CardDescription>Niveis importantes de preco identificados</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-success mb-2 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4" /> Suportes
                          </h4>
                          <div className="space-y-2">
                            {supportResistance.filter(sr => sr.type === "support").slice(0, 3).map((level, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded bg-success/10 border border-success/20">
                                <span className="font-mono text-success">{level.price.toFixed(2)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Forca: {level.strength}</span>
                                  {level.active && <Badge className="bg-success/20 text-success text-xs">Ativo</Badge>}
                                </div>
                              </div>
                            ))}
                            {supportResistance.filter(sr => sr.type === "support").length === 0 && (
                              <p className="text-sm text-muted-foreground">Nenhum suporte identificado</p>
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-destructive mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Resistencias
                          </h4>
                          <div className="space-y-2">
                            {supportResistance.filter(sr => sr.type === "resistance").slice(0, 3).map((level, i) => (
                              <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/10 border border-destructive/20">
                                <span className="font-mono text-destructive">{level.price.toFixed(2)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Forca: {level.strength}</span>
                                  {level.active && <Badge className="bg-destructive/20 text-destructive text-xs">Ativo</Badge>}
                                </div>
                              </div>
                            ))}
                            {supportResistance.filter(sr => sr.type === "resistance").length === 0 && (
                              <p className="text-sm text-muted-foreground">Nenhuma resistencia identificada</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              {/* AI Tab */}
              <TabsContent value="ai" className="space-y-4">
                {/* AI Controls */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-primary" />
                      Controles da IA
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => setIsAIActive(!isAIActive)}
                        variant={isAIActive ? "destructive" : "default"}
                        className={cn(!isAIActive && "bg-primary hover:bg-primary/90")}
                      >
                        {isAIActive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        {isAIActive ? "Parar Analise" : "Iniciar Analise"}
                      </Button>
                      
                      <Button
                        onClick={() => setIsTraining(!isTraining)}
                        variant={isTraining ? "secondary" : "outline"}
                        disabled={!isAIActive}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {isTraining ? "Treinando..." : "Treinar IA"}
                      </Button>
                      
                      <Button onClick={saveBrain} variant="outline">
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Robo
                      </Button>
                      
                      <Button onClick={loadBrain} variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Carregar Robo
                      </Button>
                      
                      <Button
                        onClick={() => {
                          neuralNetworkRef.current = new NeuralNetwork()
                          setPredictions([])
                        }}
                        variant="outline"
                      >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Resetar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* AI Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Previsoes</span>
                        <Brain className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-2xl font-bold text-foreground mt-1">{aiStats.totalPredictions}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Acertos</span>
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      </div>
                      <p className="text-2xl font-bold text-success mt-1">{aiStats.wins}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Erros</span>
                        <XCircle className="h-4 w-4 text-destructive" />
                      </div>
                      <p className="text-2xl font-bold text-destructive mt-1">{aiStats.losses}</p>
                    </CardContent>
                  </Card>
                  
                  <Card className="bg-card border-border">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Precisao</span>
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <p className="text-2xl font-bold text-foreground mt-1">{aiStats.accuracy.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Current Prediction */}
                {currentPrediction && (
                  <Card className={cn(
                    "border-2",
                    currentPrediction.direction === "CALL" ? "border-success bg-success/5" : "border-destructive bg-destructive/5"
                  )}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-3 rounded-full",
                            currentPrediction.direction === "CALL" ? "bg-success/20" : "bg-destructive/20"
                          )}>
                            {currentPrediction.direction === "CALL" ? 
                              <TrendingUp className="h-6 w-6 text-success" /> : 
                              <TrendingDown className="h-6 w-6 text-destructive" />
                            }
                          </div>
                          <div>
                            <p className="text-lg font-bold text-foreground">
                              Previsao: {currentPrediction.direction}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Entrada: {currentPrediction.entryPrice.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Confianca</p>
                          <p className="text-xl font-bold text-foreground">{currentPrediction.confidence.toFixed(0)}%</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-warning animate-pulse" />
                          <span className="text-warning">Aguardando...</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Predictions History */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Historico de Previsoes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {predictions.slice(0, 50).map((pred) => (
                          <div
                            key={pred.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg",
                              pred.result === "win" ? "bg-success/10" : pred.result === "loss" ? "bg-destructive/10" : "bg-secondary"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {pred.result === "win" ? (
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              ) : pred.result === "loss" ? (
                                <XCircle className="h-5 w-5 text-destructive" />
                              ) : (
                                <Clock className="h-5 w-5 text-warning" />
                              )}
                              <div>
                                <p className="font-medium text-foreground">{pred.direction}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(pred.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-foreground">
                                {pred.entryPrice.toFixed(2)} → {pred.exitPrice?.toFixed(2) || "..."}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Confianca: {pred.confidence.toFixed(0)}%
                              </p>
                            </div>
                          </div>
                        ))}
                        {predictions.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground">
                            Nenhuma previsao ainda. Inicie a analise da IA.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Evolution Tab */}
              <TabsContent value="evolution" className="space-y-4">
                {/* Evolution Controls */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Dna className="h-5 w-5 text-primary" />
                      Evolucao Genetica
                    </CardTitle>
                    <CardDescription>
                      Multiplos robos competem e evoluem. Cada robo tem 10 vidas. Erros eliminam robos, que sao recriados a partir dos melhores.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => {
                          setIsEvolutionMode(!isEvolutionMode)
                          if (!isEvolutionMode) {
                            setBrains([])
                            setGeneration(1)
                            setBestBrain(null)
                          }
                        }}
                        variant={isEvolutionMode ? "destructive" : "default"}
                        className={cn(!isEvolutionMode && "bg-primary hover:bg-primary/90")}
                      >
                        {isEvolutionMode ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                        {isEvolutionMode ? "Parar Evolucao" : "Iniciar Evolucao"}
                      </Button>
                      
                      <Button onClick={saveBestBrain} variant="outline" disabled={!bestBrain}>
                        <Crown className="h-4 w-4 mr-2" />
                        Salvar Melhor Robo
                      </Button>
                      
                      <Button onClick={loadEvolutionBrain} variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Carregar Robo
                      </Button>
                      
                      <div className="flex items-center gap-2 ml-auto">
                        <Badge variant="secondary" className="text-lg px-4 py-2">
                          Geracao: {generation}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Best Brain */}
                {bestBrain && (
                  <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-yellow-500/20">
                          <Crown className="h-8 w-8 text-yellow-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-lg font-bold text-foreground">Melhor Robo: {bestBrain.name}</p>
                          <p className="text-sm text-muted-foreground">Geracao {bestBrain.generation}</p>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-center">
                          <div>
                            <p className="text-2xl font-bold text-success">{bestBrain.wins}</p>
                            <p className="text-xs text-muted-foreground">Acertos</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-destructive">{bestBrain.losses}</p>
                            <p className="text-xs text-muted-foreground">Erros</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-primary">{bestBrain.accuracy.toFixed(1)}%</p>
                            <p className="text-xs text-muted-foreground">Precisao</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {/* Brains Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {brains.map((brain) => (
                    <Card
                      key={brain.id}
                      className={cn(
                        "border-border transition-all",
                        !brain.isActive && "opacity-50",
                        bestBrain?.id === brain.id && "ring-2 ring-yellow-500"
                      )}
                    >
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {brain.isActive ? (
                              <Zap className="h-4 w-4 text-primary" />
                            ) : (
                              <Skull className="h-4 w-4 text-destructive" />
                            )}
                            <span className="font-medium text-foreground text-sm">{brain.name}</span>
                          </div>
                          <Badge variant="secondary" className="text-xs">G{brain.generation}</Badge>
                        </div>
                        
                        {/* Lives */}
                        <div className="flex items-center gap-1">
                          {Array.from({ length: brain.maxLives }).map((_, i) => (
                            <Heart
                              key={i}
                              className={cn(
                                "h-3 w-3",
                                i < brain.lives ? "text-destructive fill-destructive" : "text-muted-foreground"
                              )}
                            />
                          ))}
                        </div>
                        
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="bg-success/10 rounded p-1">
                            <p className="font-bold text-success">{brain.wins}</p>
                            <p className="text-muted-foreground">Win</p>
                          </div>
                          <div className="bg-destructive/10 rounded p-1">
                            <p className="font-bold text-destructive">{brain.losses}</p>
                            <p className="text-muted-foreground">Loss</p>
                          </div>
                          <div className="bg-primary/10 rounded p-1">
                            <p className="font-bold text-primary">{brain.accuracy.toFixed(0)}%</p>
                            <p className="text-muted-foreground">Taxa</p>
                          </div>
                        </div>
                        
                        {/* Last Prediction */}
                        {brain.predictions[0] && (
                          <div className={cn(
                            "p-2 rounded text-xs text-center",
                            brain.predictions[0].result === "win" ? "bg-success/20 text-success" :
                            brain.predictions[0].result === "loss" ? "bg-destructive/20 text-destructive" :
                            "bg-warning/20 text-warning"
                          )}>
                            {brain.predictions[0].direction} - {brain.predictions[0].result === "pending" ? "..." : brain.predictions[0].result}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {brains.length === 0 && !isEvolutionMode && (
                  <Card className="bg-card border-border">
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <Dna className="h-16 w-16 text-muted-foreground mb-4" />
                      <h2 className="text-xl font-semibold text-foreground mb-2">Modo Evolucao</h2>
                      <p className="text-muted-foreground text-center max-w-md">
                        Clique em &quot;Iniciar Evolucao&quot; para criar 10 robos que vao competir e evoluir geneticamente
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  )
}
