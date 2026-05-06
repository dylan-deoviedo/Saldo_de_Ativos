"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { useRobotLogs } from "@/contexts/robot-logs-context"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Trash2 } from "lucide-react"

function levelClass(level: string) {
  switch (level) {
    case "error":
      return "text-destructive"
    case "warn":
      return "text-chart-3"
    case "tick":
      return "text-muted-foreground"
    default:
      return "text-foreground"
  }
}

export default function RobotLogsPage() {
  const { entries, clear } = useRobotLogs()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [entries.length])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Logs dos robôs</h1>
          <p className="text-sm text-muted-foreground">
            Sincronizado entre abas (BroadcastChannel). Abra esta página em outra aba enquanto opera.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/robots">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar aos robôs
            </Link>
          </Button>
          <Button variant="destructive" size="sm" onClick={clear}>
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      </div>

      <Card className="border-border">
        <ScrollArea className="h-[calc(100vh-220px)] min-h-[400px] p-4 font-mono text-xs">
          {entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">Nenhum log ainda. Inicie um robô na outra aba.</p>
          ) : (
            <ul className="space-y-1">
              {entries.map((e) => (
                <li key={e.id} className="break-words border-b border-border/50 pb-1">
                  <span className="text-muted-foreground">
                    {new Date(e.t).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>{" "}
                  <span className={levelClass(e.level)}>[{e.level}]</span>{" "}
                  {e.robotId ? (
                    <span className="text-chart-2">[{e.robotId}]</span>
                  ) : null}{" "}
                  <span className={levelClass(e.level)}>{e.message}</span>
                  {e.detail ? (
                    <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">{e.detail}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </ScrollArea>
      </Card>
    </div>
  )
}
