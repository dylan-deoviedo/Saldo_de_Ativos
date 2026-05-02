"use client"

import { ReactNode } from "react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { useDerivContext } from "@/contexts/deriv-context"
import { LoginForm } from "./login-form"

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isConnected, isLoading, error, connect } = useDerivContext()

  if (!isConnected) {
    return <LoginForm onConnect={connect} isLoading={isLoading} error={error} />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
