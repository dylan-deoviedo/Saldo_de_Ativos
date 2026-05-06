"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

const CHANNEL_NAME = "saldo-robot-logs-v1"
const MAX_ENTRIES = 800

export type RobotLogLevel = "info" | "warn" | "error" | "tick"

export interface RobotLogEntry {
  id: string
  t: number
  robotId?: string
  level: RobotLogLevel
  message: string
  detail?: string
}

interface RobotLogsContextValue {
  entries: RobotLogEntry[]
  log: (entry: Omit<RobotLogEntry, "id" | "t">) => void
  clear: () => void
}

const RobotLogsContext = createContext<RobotLogsContextValue | null>(null)

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function RobotLogsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<RobotLogEntry[]>([])
  const channelRef = useRef<BroadcastChannel | null>(null)

  const broadcast = useCallback((entry: RobotLogEntry) => {
    try {
      channelRef.current?.postMessage({ type: "append", entry })
    } catch {
      /* ignore */
    }
  }, [])

  const log = useCallback(
    (e: Omit<RobotLogEntry, "id" | "t">) => {
      const full: RobotLogEntry = {
        id: makeId(),
        t: Date.now(),
        ...e,
      }
      setEntries((prev) => [...prev.slice(-(MAX_ENTRIES - 1)), full])
      broadcast(full)
    },
    [broadcast]
  )

  const clear = useCallback(() => {
    setEntries([])
    try {
      channelRef.current?.postMessage({ type: "clear" })
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const ch = new BroadcastChannel(CHANNEL_NAME)
    channelRef.current = ch
    ch.onmessage = (ev: MessageEvent) => {
      const d = ev.data
      if (d?.type === "append" && d.entry && typeof d.entry.id === "string") {
        setEntries((prev) => {
          if (prev.some((x) => x.id === d.entry.id)) return prev
          return [...prev.slice(-(MAX_ENTRIES - 1)), d.entry as RobotLogEntry]
        })
      }
      if (d?.type === "clear") {
        setEntries([])
      }
    }
    return () => {
      ch.close()
      channelRef.current = null
    }
  }, [])

  const value = useMemo(() => ({ entries, log, clear }), [entries, log, clear])

  return <RobotLogsContext.Provider value={value}>{children}</RobotLogsContext.Provider>
}

export function useRobotLogs() {
  const ctx = useContext(RobotLogsContext)
  if (!ctx) {
    throw new Error("useRobotLogs must be used within RobotLogsProvider")
  }
  return ctx
}
