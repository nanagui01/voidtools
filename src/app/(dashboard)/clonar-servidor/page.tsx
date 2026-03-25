

import { useState, useEffect, useRef } from "react"
import {
  Copy,
  Loader2,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GuildPicker } from "@/components/guild-picker"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import { useWSEvent } from "@/hooks/use-websocket"
import { ws } from "@/lib/ws-client"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"

type Phase = "idle" | "running" | "completed" | "error"

export default function PaginaClonarServidor() {
  const { activeToken } = useTokens()
  const [sourceGuildId, setSourceGuildId] = useState("")
  const [targetGuildId, setTargetGuildId] = useState("")
  const [starting, setStarting] = useState(false)

  const [taskId, setTaskId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef<number>(0)
  const [sourceGuildName, setSourceGuildName] = useState("")
  const [sourceGuildIcon, setSourceGuildIcon] = useState<string | null>(null)
  const [targetGuildName, setTargetGuildName] = useState("")
  const [targetGuildIcon, setTargetGuildIcon] = useState<string | null>(null)

  useEffect(() => {
    if (phase !== "running") return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  useWSEvent<WSToolProgress>("tool:progress", (data) => {
    if (!taskId || data.taskId !== taskId) return
    setProgress(data.progress)
    setTotal(data.total)
    if (data.message) setStatusMessage(data.message)
    setPhase("running")
  })

  useWSEvent<WSToolCompleted>("tool:completed", (data) => {
    if (!taskId || data.taskId !== taskId) return
    setPhase("completed")
  })

  useWSEvent<WSToolError>("tool:error", (data) => {
    if (!taskId || data.taskId !== taskId) return
    setPhase("error")
    setError(data.error || "Erro desconhecido")
  })

  useEffect(() => {
    api.getTasks().then(res => {
      const tasks = ((res as any).data || []) as any[]
      const running = tasks.find((t: any) => t.status === 'running' && t.tool === 'clonar-servidor')
      if (running) {
        setTaskId(running.id)
        setProgress(running.progress ?? 0)
        setTotal(running.total ?? 0)
        startTimeRef.current = new Date(running.startedAt).getTime()
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
        setSourceGuildName((running as any).config?.sourceGuildName || '')
        setSourceGuildIcon((running as any).config?.sourceGuildIcon || null)
        setTargetGuildName((running as any).config?.targetGuildName || '')
        setTargetGuildIcon((running as any).config?.targetGuildIcon || null)
        if (running.results?.length > 0) {
          setStatusMessage(running.results[running.results.length - 1].message)
        }
        setPhase('running')
      }
    }).catch(() => {})
  }, [])

  const handleStart = async () => {
    if (!activeToken || !sourceGuildId.trim() || !targetGuildId.trim()) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("clonar-servidor", {
        tokenId: activeToken.id,
        sourceGuildId: sourceGuildId.trim(),
        targetGuildId: targetGuildId.trim(),
      })
      const data = res.data as { taskId: string; sourceGuild: { id: string; name: string; icon: string | null }; targetGuild: { id: string; name: string; icon: string | null } }
      setTaskId(data.taskId)
      setSourceGuildName(data.sourceGuild.name)
      setSourceGuildIcon(data.sourceGuild.icon)
      setTargetGuildName(data.targetGuild.name)
      setTargetGuildIcon(data.targetGuild.icon)
      setPhase("running")
      setProgress(0)
      setTotal(0)
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar")
      setPhase("error")
    } finally {
      setStarting(false)
    }
  }

  const handleCancel = () => { if (taskId) ws.cancelTask(taskId) }

  const handleReset = () => {
    setTaskId(null)
    setPhase("idle")
    setProgress(0)
    setTotal(0)
    setError("")
    setStatusMessage("")
    setElapsedSeconds(0)
    setSourceGuildName("")
    setSourceGuildIcon(null)
    setTargetGuildName("")
    setTargetGuildIcon(null)
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0

  if (phase === "idle") {
    return (
      <div className="space-y-6">
        {!activeToken && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
            <AlertTriangle size={18} className="shrink-0 text-yellow-500" />
            <span className="text-sm text-yellow-400">Conecte uma conta primeiro para usar esta ferramenta</span>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Copy size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Clonar Servidor</h2>
              <p className="text-xs text-muted-foreground">Clona a estrutura completa de um servidor para outro (cargos, canais, emojis, stickers)</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Servidor Origem</label>
              <div className="flex gap-2">
                <Input
                  placeholder="ID do servidor para copiar"
                  value={sourceGuildId}
                  onChange={(e) => setSourceGuildId(e.target.value)}
                  className="h-11 border-border bg-secondary/40 font-mono text-sm"
                  disabled={!activeToken}
                />
                <GuildPicker onSelect={setSourceGuildId} disabled={!activeToken} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Servidor Destino</label>
              <div className="flex gap-2">
                <Input
                  placeholder="ID do servidor que receberá a cópia"
                  value={targetGuildId}
                  onChange={(e) => setTargetGuildId(e.target.value)}
                  className="h-11 border-border bg-secondary/40 font-mono text-sm"
                  disabled={!activeToken}
                />
                <GuildPicker onSelect={setTargetGuildId} disabled={!activeToken} />
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle size={16} className="shrink-0 text-yellow-500" />
              <p className="text-sm text-yellow-400">
                O servidor destino terá seus canais, cargos, emojis e stickers <strong>substituídos</strong>. Certifique-se de que é o servidor correto.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <X size={16} className="shrink-0 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Button
              onClick={handleStart}
              disabled={starting || !activeToken || !sourceGuildId.trim() || !targetGuildId.trim()}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Copy size={18} className="mr-2" />}
              Iniciar Clonagem
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "running") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden">
          <div className="relative px-6 pt-6 pb-5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-secondary/40 overflow-hidden border border-border/50 flex items-center justify-center shrink-0">
                  {sourceGuildIcon ? (
                    <img src={sourceGuildIcon} alt={sourceGuildName} className="h-full w-full object-cover" />
                  ) : (
                    <Copy size={20} className="text-primary" />
                  )}
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0" />
                <div className="h-12 w-12 rounded-2xl bg-secondary/40 overflow-hidden border border-border/50 flex items-center justify-center shrink-0">
                  {targetGuildIcon ? (
                    <img src={targetGuildIcon} alt={targetGuildName} className="h-full w-full object-cover" />
                  ) : (
                    <Copy size={20} className="text-muted-foreground" />
                  )}
                </div>
                <div className="ml-1">
                  <h3 className="text-lg font-semibold text-foreground">Clonando Servidor</h3>
                  <p className="text-xs text-muted-foreground">{sourceGuildName || 'Origem'} → {targetGuildName || 'Destino'}</p>
                </div>
              </div>
              <Button onClick={handleCancel} variant="outline" size="sm" className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                <X size={16} className="mr-1" /> Cancelar
              </Button>
            </div>
          </div>
          <div className="px-6 pb-6">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Progresso</span>
                  <span className="text-sm text-muted-foreground">{pct}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{progress} de {total} etapas • {fmt(elapsedSeconds)}</p>
              </div>
              {statusMessage && (
                <p className="text-xs text-muted-foreground px-3 py-2 rounded-lg bg-secondary/20">{statusMessage}</p>
              )}
            </div>
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
            <div className="flex items-center gap-2">
              <div className="h-12 w-12 rounded-2xl bg-secondary/40 overflow-hidden border border-border/50 flex items-center justify-center shrink-0">
                {sourceGuildIcon ? (
                  <img src={sourceGuildIcon} alt={sourceGuildName} className="h-full w-full object-cover" />
                ) : (
                  <CheckCircle2 size={20} className="text-green-400" />
                )}
              </div>
              <ArrowRight size={14} className="text-muted-foreground" />
              <div className="h-12 w-12 rounded-2xl bg-secondary/40 overflow-hidden border border-border/50 flex items-center justify-center shrink-0">
                {targetGuildIcon ? (
                  <img src={targetGuildIcon} alt={targetGuildName} className="h-full w-full object-cover" />
                ) : (
                  <CheckCircle2 size={20} className="text-green-400" />
                )}
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-400">Clonagem concluída!</h3>
              <p className="text-sm text-muted-foreground">
                {sourceGuildName && targetGuildName ? `${sourceGuildName} → ${targetGuildName} • ` : ''}{fmt(elapsedSeconds)}
              </p>
            </div>
            <Button onClick={handleReset} variant="outline" className="h-10">
              <RotateCcw size={16} className="mr-2" /> Voltar
            </Button>
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
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-400">Erro na clonagem</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button onClick={handleReset} variant="outline" className="h-10">
              <RotateCcw size={16} className="mr-2" /> Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }
  return null
}
