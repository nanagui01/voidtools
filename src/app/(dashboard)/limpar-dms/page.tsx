

import { useState, useEffect, useRef } from "react"
import {
  Trash2,
  Loader2,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  Timer,
  Archive,
  HardDrive,
  PhoneOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import { useWSEvent } from "@/hooks/use-websocket"
import { ws } from "@/lib/ws-client"
import { Link } from "react-router-dom"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"
import type { AppSettings } from "@/types/api"

type Phase = "idle" | "running" | "completed" | "error"

export default function PaginaLimparDmsAbertas() {
  const { activeToken } = useTokens()
  const [configDelay, setConfigDelay] = useState(700)
  const [fazerBackup, setFazerBackup] = useState(false)
  const [salvarMidiaLocal, setSalvarMidiaLocal] = useState(false)
  const [fecharApos, setFecharApos] = useState(false)
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
    api.getSettings().then((res) => {
      const data = res.data as AppSettings
      if (data?.delay) setConfigDelay(data.delay)
    }).catch(() => {})
  }, [])

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

  const handleStart = async () => {
    if (!activeToken) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("limpar-dms-abertas", {
        tokenId: activeToken.id,
        delay: configDelay,
        fazerBackup,
        salvarMidiaLocal,
        fecharApos,
      })
      const data = res.data as { taskId: string }
      setTaskId(data.taskId)
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
              <Trash2 size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Limpar DMs Abertas</h2>
              <p className="text-xs text-muted-foreground">Apaga suas mensagens em todas as DMs abertas</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Delay (ms)
              </label>
              <div className="flex h-11 items-center rounded-md border border-border bg-secondary/20 px-4 text-sm tabular-nums text-foreground">
                {configDelay}ms
              </div>
              <Link to="/configuracoes" className="inline-block text-[11px] text-muted-foreground hover:text-primary transition-colors">
                Alterar nas configurações →
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Archive size={16} className="text-primary/70" />
                <div>
                  <span className="text-sm font-medium text-foreground">Fazer backup antes de apagar</span>
                  <p className="text-xs text-muted-foreground">Salva as mensagens de cada DM antes de apagar</p>
                </div>
              </div>
              <Switch checked={fazerBackup} onCheckedChange={setFazerBackup} />
            </div>

            {fazerBackup && (
              <div className="ml-7 flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-3">
                  <HardDrive size={14} className="text-primary/70" />
                  <div>
                    <span className="text-sm font-medium text-foreground">Salvar mídia localmente</span>
                    <p className="text-xs text-muted-foreground">Baixa imagens, vídeos e arquivos para o disco</p>
                  </div>
                </div>
                <Switch checked={salvarMidiaLocal} onCheckedChange={setSalvarMidiaLocal} />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PhoneOff size={16} className="text-primary/70" />
                <div>
                  <span className="text-sm font-medium text-foreground">Fechar DM após limpar</span>
                  <p className="text-xs text-muted-foreground">Fecha cada DM automaticamente após apagar as mensagens</p>
                </div>
              </div>
              <Switch checked={fecharApos} onCheckedChange={setFecharApos} />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <X size={16} className="shrink-0 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div className="mt-6">
            <Button onClick={handleStart} disabled={starting || !activeToken} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Play size={18} className="mr-2" />}
              Iniciar Limpeza de Todas as DMs
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
                <Trash2 size={18} className="text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Limpando DMs Abertas</h3>
                <p className="text-xs text-muted-foreground">Processando todas as conversas...</p>
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
                {progress} de {total} • {fmt(elapsedSeconds)}
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
              <h3 className="text-lg font-semibold text-green-400">Limpeza concluída!</h3>
              <p className="text-sm text-muted-foreground">{progress} mensagens deletadas em {fmt(elapsedSeconds)}</p>
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
