

import { useState, useEffect, useRef } from "react"
import {
  Image,
  Loader2,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChannelPicker } from "@/components/channel-picker"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import { useWSEvent } from "@/hooks/use-websocket"
import { ws } from "@/lib/ws-client"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"

type Phase = "idle" | "running" | "completed" | "error"

export default function PaginaScraperIcones() {
  const { activeToken } = useTokens()
  const [sourceChannelId, setSourceChannelId] = useState("")
  const [fileType, setFileType] = useState<"png/jpg" | "gif" | "todos">("todos")
  const [sendMethod, setSendMethod] = useState<"webhook" | "channel">("webhook")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [targetChannelId, setTargetChannelId] = useState("")
  const [imagesPerMessage, setImagesPerMessage] = useState(5)
  const [delay, setDelay] = useState(1500)
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
      const running = tasks.find((t: any) => t.status === 'running' && t.tool === 'scraper-icons')
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
    if (!activeToken || !sourceChannelId.trim()) return
    if (sendMethod === "webhook" && !webhookUrl.trim()) return
    if (sendMethod === "channel" && !targetChannelId.trim()) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("scraper-icons", {
        tokenId: activeToken.id,
        sourceChannelId: sourceChannelId.trim(),
        fileType,
        sendMethod,
        webhookUrl: sendMethod === "webhook" ? webhookUrl.trim() : undefined,
        targetChannelId: sendMethod === "channel" ? targetChannelId.trim() : undefined,
        imagesPerMessage,
        delay,
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
              <Image size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Scraper de Ícones</h2>
              <p className="text-xs text-muted-foreground">Coleta imagens de um canal e envia para outro destino</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Canal Origem</label>
              <div className="flex gap-2">
                <Input
                  placeholder="ID do canal com as imagens"
                  value={sourceChannelId}
                  onChange={(e) => setSourceChannelId(e.target.value)}
                  className="h-11 border-border bg-secondary/40 font-mono text-sm"
                  disabled={!activeToken}
                />
                <ChannelPicker onSelect={setSourceChannelId} disabled={!activeToken} type="text" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tipo de Arquivo</label>
              <div className="flex gap-2">
                {(["todos", "png/jpg", "gif"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFileType(t)}
                    className={`h-11 flex-1 rounded-md border text-sm font-medium transition-colors ${
                      fileType === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "todos" ? "Todos" : t === "png/jpg" ? "PNG/JPG" : "GIF"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Método de Envio</label>
              <div className="flex gap-2">
                {(["webhook", "channel"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setSendMethod(m)}
                    className={`h-11 flex-1 rounded-md border text-sm font-medium transition-colors ${
                      sendMethod === m
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "webhook" ? "Webhook" : "Canal"}
                  </button>
                ))}
              </div>
            </div>

            {sendMethod === "webhook" && (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">URL do Webhook</label>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="h-11 border-border bg-secondary/40 font-mono text-sm"
                />
              </div>
            )}

            {sendMethod === "channel" && (
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Canal Destino</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="ID do canal para enviar as imagens"
                    value={targetChannelId}
                    onChange={(e) => setTargetChannelId(e.target.value)}
                    className="h-11 border-border bg-secondary/40 font-mono text-sm"
                  />
                  <ChannelPicker onSelect={setTargetChannelId} disabled={!activeToken} type="text" />
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Imagens por Mensagem</label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={imagesPerMessage}
                  onChange={(e) => setImagesPerMessage(Number(e.target.value))}
                  className="h-11 border-border bg-secondary/40 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Delay (ms)</label>
                <Input
                  type="number"
                  min={500}
                  value={delay}
                  onChange={(e) => setDelay(Number(e.target.value))}
                  className="h-11 border-border bg-secondary/40 text-sm"
                />
              </div>
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
              disabled={
                starting ||
                !activeToken ||
                !sourceChannelId.trim() ||
                (sendMethod === "webhook" && !webhookUrl.trim()) ||
                (sendMethod === "channel" && !targetChannelId.trim())
              }
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Image size={18} className="mr-2" />}
              Iniciar Scraper
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
                <Image size={18} className="text-primary animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Coletando Imagens</h3>
                <p className="text-xs text-muted-foreground">Processando canal...</p>
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
              <p className="mt-1 text-xs text-muted-foreground">{progress} de {total} • {fmt(elapsedSeconds)}</p>
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
              <h3 className="text-lg font-semibold text-green-400">Scraper concluído!</h3>
              <p className="text-sm text-muted-foreground">{progress} imagens enviadas em {fmt(elapsedSeconds)}</p>
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
