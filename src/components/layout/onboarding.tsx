
import { useState, useEffect } from "react"
import { Sparkles, Search, Loader2, Plus, CheckCircle, XCircle, KeyRound, ScanLine } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { api } from "@/lib/api-client"
import type { Badge } from "@/types/discord"

interface ScannedToken {
  token: string
  fullToken?: string
  source: string
  username?: string
  id?: string
  avatar?: string
  avatarUrl?: string | null
  badges?: Badge[]
  valid: boolean
  selected: boolean
}

interface OnboardingProps {
  onComplete: () => void
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [etapa, setEtapa] = useState<"inicio" | "scanning" | "resultados" | "manual">("inicio")
  const [tokensEncontradas, setTokensEncontradas] = useState<ScannedToken[]>([])
  const [salvando, setSalvando] = useState(false)
  const [manualLabel, setManualLabel] = useState("")
  const [manualToken, setManualToken] = useState("")
  const [manualAdding, setManualAdding] = useState(false)

  const handleScan = async () => {
    setEtapa("scanning")
    try {
      const res = await api.scanTokens()
      const rawResponse = res as any
      const data = (rawResponse.data || []) as Array<ScannedToken>
      const internalTokens = (rawResponse._internal || []) as Array<{ token: string; source: string }>
      
      const tokens = data.map((t, i) => ({
        ...t,
        fullToken: internalTokens[i]?.token || t.token,
        selected: true,
      }))
      setTokensEncontradas(tokens)
      setEtapa("resultados")
    } catch {
      setTokensEncontradas([])
      setEtapa("resultados")
    }
  }

  const toggleToken = (index: number) => {
    setTokensEncontradas((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    )
  }

  const handleAddSelected = async () => {
    const selected = tokensEncontradas.filter((t) => t.selected)
    if (selected.length === 0) return

    setSalvando(true)
    try {
      await api.addScannedTokens(
        selected.map((t) => ({
          token: t.fullToken || t.token,
          username: t.username,
        }))
      )
      onComplete()
    } catch {
    } finally {
      setSalvando(false)
    }
  }

  const handleManualAdd = async () => {
    if (!manualLabel.trim() || !manualToken.trim()) return
    setManualAdding(true)
    try {
      await api.addToken(manualLabel.trim(), manualToken.trim())
      setManualLabel("")
      setManualToken("")
      onComplete()
    } catch {} finally {
      setManualAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="absolute top-0 left-0 right-0 z-50 flex h-10 items-center justify-end px-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {typeof window !== 'undefined' && (window as any).electronAPI && (
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button onClick={() => (window as any).electronAPI.window.minimize()} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/></svg>
            </button>
            <button onClick={() => (window as any).electronAPI.window.maximize()} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </button>
            <button onClick={() => (window as any).electronAPI.window.close()} className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/80 hover:text-white">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg px-6">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Sparkles size={32} className="text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold texto-neon text-primary">BrunnoClear</h1>
          <p className="mt-2 text-sm text-muted-foreground">Discord Multi-Tool</p>
        </div>

        {etapa === "inicio" && (
          <Card className="border-border bg-card/80 backdrop-blur-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-xl text-foreground">Bem-vindo!</CardTitle>
              <CardDescription>
                Nenhuma conta encontrada. Como deseja adicionar sua primeira conta?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={handleScan}
                className="w-full h-14 bg-primary text-primary-foreground hover:bg-primary/90 text-base"
              >
                <ScanLine size={20} className="mr-3" />
                Buscar automaticamente
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Procura tokens no Discord instalado no seu PC
              </p>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">ou</span>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setEtapa("manual")}
                className="w-full h-12 border-border text-foreground hover:bg-secondary"
              >
                <KeyRound size={18} className="mr-3" />
                Adicionar manualmente
              </Button>
            </CardContent>
          </Card>
        )}

        {etapa === "scanning" && (
          <Card className="border-border bg-card/80 backdrop-blur-xl">
            <CardContent className="flex flex-col items-center py-16">
              <div className="relative mb-6">
                <Loader2 size={48} className="animate-spin text-primary" />
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Buscando tokens...</h3>
              <p className="mt-2 text-sm text-muted-foreground text-center">
                Verificando Discord, Discord Canary, Discord PTB...
              </p>
            </CardContent>
          </Card>
        )}

        {etapa === "resultados" && (
          <Card className="border-border bg-card/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Search size={20} className="text-primary" />
                Tokens Encontradas
              </CardTitle>
              <CardDescription>
                {tokensEncontradas.length > 0
                  ? `${tokensEncontradas.length} conta(s) encontrada(s). Selecione quais deseja adicionar.`
                  : "Nenhuma token válida encontrada no sistema."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tokensEncontradas.length > 0 ? (
                <>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {tokensEncontradas.map((token, i) => (
                      <div
                        key={i}
                        onClick={() => toggleToken(i)}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          token.selected
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-secondary/20 opacity-60"
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          token.selected ? "bg-primary border-primary" : "border-border"
                        }`}>
                          {token.selected && <span className="text-primary-foreground text-xs">✓</span>}
                        </div>
                        {token.avatar ? (
                          <img
                            src={token.avatarUrl || `https://cdn.discordapp.com/avatars/${token.id}/${token.avatar}.png?size=32`}
                            alt=""
                            className="h-8 w-8 rounded-full"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">
                              {(token.username || "?")[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground truncate">
                              {token.username || "Conta desconhecida"}
                            </p>
                            {token.badges && token.badges.length > 0 && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                {token.badges.map((badge) => (
                                  <Tooltip key={badge.name}>
                                    <TooltipTrigger asChild>
                                      <img src={badge.url} alt={badge.tooltip} className="h-4 w-4" />
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">{badge.tooltip}</TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{token.source} • {token.token}</p>
                        </div>
                        <CheckCircle size={16} className={token.valid ? "text-green-500" : "text-red-500"} />
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={handleAddSelected}
                    disabled={salvando || !tokensEncontradas.some((t) => t.selected)}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {salvando ? (
                      <Loader2 size={16} className="animate-spin mr-2" />
                    ) : (
                      <Plus size={16} className="mr-2" />
                    )}
                    Adicionar {tokensEncontradas.filter((t) => t.selected).length} conta(s)
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center py-4">
                  <XCircle size={32} className="text-muted-foreground mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Não foi possível encontrar tokens. Tente adicionar manualmente.
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                onClick={() => setEtapa("manual")}
                className="w-full border-border text-foreground hover:bg-secondary"
              >
                <KeyRound size={16} className="mr-2" />
                Adicionar manualmente
              </Button>

              {tokensEncontradas.length === 0 && (
                <Button
                  variant="ghost"
                  onClick={handleScan}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Tentar novamente
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {etapa === "manual" && (
          <Card className="border-border bg-card/80 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <KeyRound size={20} className="text-primary" />
                Adicionar Token
              </CardTitle>
              <CardDescription>Insira o token da sua conta Discord</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome da conta</label>
                <Input
                  placeholder="Ex: Minha conta principal"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  className="border-border bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Token</label>
                <Input
                  placeholder="Cole o token aqui"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="border-border bg-secondary/50 font-mono"
                  type="password"
                />
              </div>
              <Button
                onClick={handleManualAdd}
                disabled={manualAdding || !manualLabel.trim() || !manualToken.trim()}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {manualAdding ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Plus size={16} className="mr-2" />
                )}
                Adicionar Conta
              </Button>
              <Button
                variant="ghost"
                onClick={() => setEtapa("inicio")}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Voltar
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
