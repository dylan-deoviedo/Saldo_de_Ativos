"use client"

import { useDerivContext } from "@/contexts/deriv-context"
import { BalanceCard } from "@/components/deriv/balance-card"
import { AssetsList } from "@/components/deriv/assets-list"
import { TicketsList } from "@/components/deriv/tickets-list"

export default function DashboardPage() {
  const { balance, assets, tickets, accounts, refreshData, isLoading } = useDerivContext()

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visao geral da sua conta Deriv
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Balance Card */}
        <div className="lg:col-span-1">
          <BalanceCard
            balance={balance}
            accounts={accounts}
            onRefresh={refreshData}
            isLoading={isLoading}
          />
        </div>

        {/* Stats Row */}
        <div className="lg:col-span-2 grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Total de Ativos"
            value={assets.length.toString()}
            description="Ativos disponiveis"
            color="primary"
          />
          <StatCard
            title="Contratos Ativos"
            value={tickets.filter((t) => t.status === "open").length.toString()}
            description="Em andamento"
            color="chart-3"
          />
          <StatCard
            title="Mercados"
            value={new Set(assets.map((a) => a.market_display_name)).size.toString()}
            description="Categorias disponiveis"
            color="chart-2"
          />
        </div>
      </div>

      {/* Assets and Tickets */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AssetsList assets={assets} />
        <TicketsList tickets={tickets} />
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  description: string
  color: "primary" | "chart-2" | "chart-3" | "chart-4"
}

function StatCard({ title, value, description, color }: StatCardProps) {
  const colorClasses = {
    primary: "text-primary",
    "chart-2": "text-chart-2",
    "chart-3": "text-chart-3",
    "chart-4": "text-chart-4",
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className={`mt-1 text-2xl font-bold ${colorClasses[color]}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
