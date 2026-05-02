"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  LineChart,
  LogOut,
  Wallet,
  TrendingUp,
} from "lucide-react"
import { useDerivContext } from "@/contexts/deriv-context"

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Gráficos",
    href: "/charts",
    icon: LineChart,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { balance, disconnect, isConnected } = useDerivContext()

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-foreground">Deriv</h1>
            <p className="text-xs text-muted-foreground">Trading Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">
            Menu Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isConnected && balance && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground">
              Conta
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 py-3 rounded-lg bg-secondary/50 mx-2">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Saldo</span>
                </div>
                <p className="text-lg font-bold text-foreground">
                  {balance.currency} {balance.balance.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {balance.loginid}
                </p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border">
        {isConnected && (
          <Button
            variant="outline"
            size="sm"
            onClick={disconnect}
            className="w-full border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Desconectar
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
