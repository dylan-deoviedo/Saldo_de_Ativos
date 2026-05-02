"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet, TrendingUp, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { DerivBalance, DerivAccount } from "@/contexts/deriv-context"

interface BalanceCardProps {
  balance: DerivBalance | null
  accounts: DerivAccount[]
  onRefresh: () => void
  isLoading?: boolean
}

export function BalanceCard({ balance, accounts, onRefresh, isLoading }: BalanceCardProps) {
  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(value)
  }

  const virtualAccounts = accounts.filter((acc) => acc.is_virtual)
  const realAccounts = accounts.filter((acc) => !acc.is_virtual)

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Saldo da Conta
        </CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <div>
            {balance ? (
              <>
                <div className="text-2xl font-bold text-foreground">
                  {formatCurrency(balance.balance, balance.currency)}
                </div>
                <p className="text-sm text-muted-foreground">
                  ID: {balance.loginid}
                </p>
              </>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">--</div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-secondary/50 p-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Contas Reais</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {realAccounts.length}
            </p>
          </div>
          <div className="rounded-lg bg-secondary/50 p-3">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-chart-2" />
              <span className="text-xs text-muted-foreground">Contas Demo</span>
            </div>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {virtualAccounts.length}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
