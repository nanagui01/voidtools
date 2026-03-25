

import { useState } from "react"
import { PhoneOff, Loader2, CheckCircle2, AlertTriangle, X, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChannelPicker } from "@/components/channel-picker"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"

type Phase = "idle" | "completed" | "error"

export default function PaginaDesconectarCall() {
  const { activeToken } = useTokens()
  const [channelId, setChannelId] = useState("")
  const [starting, setStarting] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState<{ desconectados: number; total: number } | null>(null)

  const handleStart = async () => {
    if (!activeToken || !channelId.trim()) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("call-utils", {
        tokenId: activeToken.id,
        action: "disconnect-all",
        channelId: channelId.trim(),
      })
      const data = res.data as { desconectados: number; total: number }
      setResultado(data)
      setPhase("completed")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro")
      setPhase("error")
    } finally {
      setStarting(false)
    }
  }

  const handleReset = () => { setPhase("idle"); setError(""); setResultado(null) }

  if (phase === "idle") {
    return (
      <div className="space-y-6">
        {!activeToken && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
            <AlertTriangle size={18} className="shrink-0 text-yellow-500" />
            <span className="text-sm text-yellow-400">Conecte uma conta primeiro</span>
          </div>
        )}
        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
              <PhoneOff size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Desconectar Call</h2>
              <p className="text-xs text-muted-foreground">Desconecta todos os membros de um canal de voz</p>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Canal de Voz</label>
            <div className="flex gap-2">
              <Input placeholder="ID do canal de voz" value={channelId} onChange={(e) => setChannelId(e.target.value)} className="h-11 border-border bg-secondary/40 font-mono text-sm" disabled={!activeToken} />
              <ChannelPicker onSelect={setChannelId} disabled={!activeToken} type="voice" />
            </div>
          </div>
          {error && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <X size={16} className="shrink-0 text-red-400" /><span className="text-sm text-red-400">{error}</span>
            </div>
          )}
          <div className="mt-6">
            <Button onClick={handleStart} disabled={starting || !activeToken || !channelId.trim()} className="h-11 w-full bg-red-600 text-white hover:bg-red-700">
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <PhoneOff size={18} className="mr-2" />}
              Desconectar Todos
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (phase === "completed") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center"><CheckCircle2 size={24} className="text-green-400" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-400">Concluído!</h3>
              <p className="text-sm text-muted-foreground">{resultado?.desconectados} de {resultado?.total} membros desconectados</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="h-10"><RotateCcw size={16} className="mr-2" /> Voltar</Button>
          </div>
        </div>
      </div>
    )
  }
  if (phase === "error") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center"><AlertTriangle size={24} className="text-red-400" /></div>
            <div className="flex-1"><h3 className="text-lg font-semibold text-red-400">Erro</h3><p className="text-sm text-muted-foreground">{error}</p></div>
            <Button onClick={handleReset} variant="outline" className="h-10"><RotateCcw size={16} className="mr-2" /> Tentar novamente</Button>
          </div>
        </div>
      </div>
    )
  }
  return null
}
