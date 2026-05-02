"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, Key, AlertCircle, ExternalLink } from "lucide-react"

interface LoginFormProps {
  onConnect: (token: string) => void
  isLoading: boolean
  error: string | null
}

export function LoginForm({ onConnect, isLoading, error }: LoginFormProps) {
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (token.trim()) {
      onConnect(token.trim())
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-2">
            <Key className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-foreground">
            Deriv Dashboard
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Conecte-se com seu token de API da Deriv para visualizar seu saldo,
            ativos e tickets.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token" className="text-foreground">
                Token de API
              </Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="Cole seu token aqui..."
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="pr-10 bg-secondary border-border"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!token.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⟳</span>
                  Conectando...
                </>
              ) : (
                "Conectar"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Não tem um token?{" "}
              <a
                href="https://app.deriv.com/account/api-token"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Crie um na Deriv
                <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Escopos necessários: <span className="text-foreground">read, trade</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
