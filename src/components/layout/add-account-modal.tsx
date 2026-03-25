

import { useState } from "react"
import { ScanLine, KeyRound, Loader2, Plus, CheckCircle, XCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onAdded: () => void
}

export function AddAccountModal({ open, onClose, onAdded }: AddAccountModalProps) {
  const [modo, setModo] = useState<"escolha" | "scanning" | "resultados" | "manual">("escolha")
  const [tokensEncontradas, setTokensEncontradas] = useState<ScannedToken[]>([])
  const [salvando, setSalvando] = useState(false)
  const [manualLabel, setManualLabel] = useState("")
  const [manualToken, setManualToken] = useState("")
  const [manualAdding, setManualAdding] = useState(false)

  if (!open) return null

  const handleScan = async () => {
    setModo("scanning")
    try {
      const res = await api.scanTokens()
      const rawResponse = res as any
      const data = (rawResponse.data || []) as Array<ScannedToken>
      const internalTokens = (rawResponse._internal || []) as Array<{ token: string; source: string }>
      setTokensEncontradas(data.map((t, i) => ({
        ...t,
        fullToken: internalTokens[i]?.token || t.token,
        selected: true,
      })))
      setModo("resultados")
    } catch {
      setTokensEncontradas([])
      setModo("resultados")
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
      await api.addScannedTokens(selected.map((t) => ({ token: t.fullToken || t.token, username: t.username })))
      await onAdded()
      handleClose()
    } catch {} finally {
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
      await onAdded()
      handleClose()
    } catch {} finally {
      setManualAdding(false)
    }
  }

  const handleClose = () => {
    setModo("escolha")
    setTokensEncontradas([])
    setManualLabel("")
    setManualToken("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Adicionar Conta</h2>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {modo === "escolha" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Como deseja adicionar a conta?
              </p>
              <Button onClick={handleScan} className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90">
                <ScanLine size={18} className="mr-3" />
                Buscar automaticamente
              </Button>
              <Button variant="outline" onClick={() => setModo("manual")} className="w-full h-12 border-border text-foreground hover:bg-secondary">
                <KeyRound size={18} className="mr-3" />
                Adicionar manualmente
              </Button>
            </div>
          )}

          {modo === "scanning" && (
            <div className="flex flex-col items-center py-10">
              <Loader2 size={40} className="animate-spin text-primary mb-4" />
              <p className="text-sm text-foreground">Buscando tokens no sistema...</p>
              <p className="text-xs text-muted-foreground mt-1">Discord, Canary, PTB...</p>
            </div>
          )}

          {modo === "resultados" && (
            <div className="space-y-3">
              {tokensEncontradas.length > 0 ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    {tokensEncontradas.length} conta(s) nova(s) encontrada(s)
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {tokensEncontradas.map((token, i) => (
                      <div
                        key={i}
                        onClick={() => toggleToken(i)}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                          token.selected ? "border-primary/50 bg-primary/5" : "border-border opacity-50"
                        }`}
                      >
                        <div className={`h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center ${
                          token.selected ? "bg-primary border-primary" : "border-border"
                        }`}>
                          {token.selected && <span className="text-primary-foreground text-[10px]">✓</span>}
                        </div>
                        <Avatar className="h-9 w-9 shrink-0 border border-border">
                          <AvatarImage src={token.avatarUrl || undefined} alt={token.username} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {(token.username || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground truncate">{token.username || "Desconhecido"}</p>
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
                          <p className="text-xs text-muted-foreground">{token.source}</p>
                        </div>
                        <CheckCircle size={14} className="text-green-500 shrink-0" />
                      </div>
                    ))}
                  </div>
                  <Button onClick={handleAddSelected} disabled={salvando || !tokensEncontradas.some((t) => t.selected)} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    {salvando ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                    Adicionar {tokensEncontradas.filter((t) => t.selected).length} conta(s)
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center py-6">
                  <XCircle size={28} className="text-muted-foreground mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">Nenhuma token nova encontrada</p>
                </div>
              )}
              <Button variant="outline" onClick={() => setModo("manual")} className="w-full border-border text-foreground hover:bg-secondary">
                <KeyRound size={14} className="mr-2" />
                Adicionar manualmente
              </Button>
            </div>
          )}

          {modo === "manual" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nome da conta</label>
                <Input
                  placeholder="Ex: Alt"
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
              <Button onClick={handleManualAdd} disabled={manualAdding || !manualLabel.trim() || !manualToken.trim()} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {manualAdding ? <Loader2 size={14} className="animate-spin mr-2" /> : <Plus size={14} className="mr-2" />}
                Adicionar
              </Button>
              <Button variant="ghost" onClick={() => setModo("escolha")} className="w-full text-muted-foreground hover:text-foreground text-sm">
                Voltar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
