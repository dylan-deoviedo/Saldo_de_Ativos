"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, TrendingUp, TrendingDown, Clock } from "lucide-react"
import type { DerivTicket } from "@/contexts/deriv-context"

interface TicketsListProps {
  tickets: DerivTicket[]
}

export function TicketsList({ tickets }: TicketsListProps) {
  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string, profit: number) => {
    if (status === "open") {
      return (
        <Badge variant="outline" className="text-chart-3 border-chart-3">
          <Clock className="h-3 w-3 mr-1" />
          Aberto
        </Badge>
      )
    }
    if (profit >= 0) {
      return (
        <Badge className="bg-primary/20 text-primary border-0">
          <TrendingUp className="h-3 w-3 mr-1" />
          Ganho
        </Badge>
      )
    }
    return (
      <Badge className="bg-destructive/20 text-destructive border-0">
        <TrendingDown className="h-3 w-3 mr-1" />
        Perda
      </Badge>
    )
  }

  const totalProfit = tickets.reduce((sum, ticket) => sum + ticket.profit, 0)
  const openTickets = tickets.filter((t) => t.status === "open").length

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tickets / Contratos
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {tickets.length} contratos
          </Badge>
        </div>
        {tickets.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Contratos Abertos</p>
              <p className="text-lg font-semibold text-foreground">{openTickets}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-3">
              <p className="text-xs text-muted-foreground">Lucro/Prejuízo</p>
              <p
                className={`text-lg font-semibold ${
                  totalProfit >= 0 ? "text-primary" : "text-destructive"
                }`}
              >
                {totalProfit >= 0 ? "+" : ""}
                {totalProfit.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6 pb-6">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum contrato aberto</p>
              <p className="text-xs mt-1">
                Seus contratos ativos aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <div
                  key={ticket.contract_id}
                  className="rounded-lg border border-border bg-secondary/30 p-4 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {ticket.underlying_display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ticket.contract_type} • ID: {ticket.contract_id}
                      </p>
                    </div>
                    {getStatusBadge(ticket.status, ticket.profit)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Compra</p>
                      <p className="font-medium text-foreground">
                        {formatCurrency(ticket.buy_price, ticket.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pagamento</p>
                      <p className="font-medium text-foreground">
                        {formatCurrency(ticket.payout, ticket.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Lucro</p>
                      <p
                        className={`font-medium ${
                          ticket.profit >= 0 ? "text-primary" : "text-destructive"
                        }`}
                      >
                        {ticket.profit >= 0 ? "+" : ""}
                        {formatCurrency(ticket.profit, ticket.currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Expiração</p>
                      <p className="font-medium text-foreground">
                        {formatDate(ticket.expiry_time)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                    {ticket.longcode}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
