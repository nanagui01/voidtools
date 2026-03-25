

import { useState, useEffect, useRef } from "react"
import {
  PhoneOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import { useWSEvent } from "@/hooks/use-websocket"
import { ws } from "@/lib/ws-client"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"

type Phase = "idle" | "running" | "completed" | "error"

export default function PaginaFecharDms() {
  const { activeToken } = useTokens()
  const [starting, setStarting] = useState(false)

  const [taskId, setTaskId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [statusMessage, setStatusMessage] = useState("")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef<number>(0)

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
      const running = tasks.find((t: any) => t.status === 'running' && t.tool === 'fechar-dms')
      if (running) {
        setTaskId(running.id)
        setProgress(running.progress ?? 0)
        setTotal(running.total ?? 0)
        startTimeRef.current = new Date(running.startedAt).getTime()
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
        if (running.results?.length > 0) {
          setStatusMessage(running.results[running.results.length - 1].message)
        }
        setPhase('running')
      }
    }).catch(() => {})
  }, [])

  const handleStart = async () => {
    if (!activeToken) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("fechar-dms", {
        tokenId: activeToken.id,
      })
      const data = res.data as { taskId: string }
      setTaskId(data.taskId)
      setPhase("running")
      setProgress(0)
      setTotal(0)
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao fechar DMs")
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
              <PhoneOff size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Fechar DMs</h2>
              <p className="text-xs text-muted-foreground">Fecha todas as DMs abertas da conta (não apaga mensagens)</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-secondary/10 p-4">
            <p className="text-sm text-muted-foreground">
              Esta ferramenta fecha todas as conversas privadas abertas. As mensagens <strong className="text-foreground">não</strong> serão apagadas — apenas a DM será removida da lista de mensagens diretas.
            </p>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <X size={16} className="shrink-0 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleStart} disabled={starting || !activeToken} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <PhoneOff size={18} className="mr-2" />}
              Fechar Todas as DMs
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "running") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border/50 bg-card/20 backdrop-blur-sm p-6">
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <PhoneOff size={18} className="text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Fechando DMs</h3>
                <p className="text-xs text-muted-foreground">Fechando conversas abertas...</p>
              </div>
            </div>
            <Button onClick={handleCancel} variant="outline" size="sm" className="h-9">
              <X size={16} className="mr-1" /> Cancelar
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Progresso</span>
                <span className="text-sm text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {progress} de {total} DMs fechadas • {fmt(elapsedSeconds)}
              </p>
            </div>
            {statusMessage && (
              <p className="text-xs text-muted-foreground px-3 py-2 rounded-lg bg-secondary/20">{statusMessage}</p>
            )}
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
            <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 size={24} className="text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-400">DMs fechadas!</h3>
              <p className="text-sm text-muted-foreground">{progress} de {total} DMs foram fechadas em {fmt(elapsedSeconds)}</p>
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
              <h3 className="text-lg font-semibold text-red-400">Erro</h3>
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
