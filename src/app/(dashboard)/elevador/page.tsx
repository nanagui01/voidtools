

import { useState, useEffect, useRef } from "react"
import { Anchor, Loader2, CheckCircle2, AlertTriangle, StopCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChannelPicker } from "@/components/channel-picker"
import { useTokens } from "@/hooks/use-tokens"
import { useWSEvent } from "@/hooks/use-websocket"
import { api } from "@/lib/api-client"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"

type Phase = "idle" | "running" | "completed" | "error"

export default function PaginaElevador() {
  const { activeToken } = useTokens()
  const [userId, setUserId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [starting, setStarting] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [username, setUsername] = useState("")

  useWSEvent<WSToolProgress>("tool:progress", (data) => {
    if (data.taskId !== taskId) return
    setStatus(data.message)
  })

  useWSEvent<WSToolCompleted>("tool:completed", (data) => {
    if (data.taskId !== taskId) return
    setPhase("completed")
  })

  useWSEvent<WSToolError>("tool:error", (data) => {
    if (data.taskId !== taskId) return
    setError((data as any).error || "Erro desconhecido")
    setPhase("error")
  })

  useEffect(() => {
    api.getTasks().then(res => {
      const tasks = ((res as any).data || []) as any[]
      const running = tasks.find((t: any) =>
        (t.status === 'running' || t.status === 'paused') &&
        t.tool === 'call-utils' &&
        t.config?.subAction === 'elevator'
      )
      if (running) {
        setTaskId(running.id)
        setUsername(running.config?.username || '')
        if (running.results?.length > 0) {
          setStatus(running.results[running.results.length - 1].message)
        } else {
          setStatus(`Elevador ativo para ${running.config?.username || '...'}`)
        }
        setPhase('running')
      }
    }).catch(() => {})
  }, [])

  const handleStart = async () => {
    if (!activeToken || !userId.trim() || !categoryId.trim()) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("call-utils", {
        tokenId: activeToken.id,
        action: "elevator",
        userIds: [userId.trim()],
        categoryId: categoryId.trim(),
      })
      const data = res.data as { taskId: string; username: string }
      setTaskId(data.taskId)
      setUsername(data.username)
      setStatus(`Elevador ativo para ${data.username}`)
      setPhase("running")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro")
      setPhase("error")
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    if (!taskId) return
    try {
      await api.delete(`/tools/call-utils/${taskId}`)
      setPhase("completed")
    } catch {}
  }

  const handleReset = () => { setPhase("idle"); setError(""); setTaskId(null); setStatus(""); setUsername("") }

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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10">
              <Anchor size={18} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Elevador</h2>
              <p className="text-xs text-muted-foreground">Move um usuário rapidamente entre canais de voz de uma categoria</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Usuário</label>
              <Input placeholder="ID do usuário alvo" value={userId} onChange={(e) => setUserId(e.target.value)} className="h-11 border-border bg-secondary/40 font-mono text-sm" disabled={!activeToken} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID da Categoria</label>
              <div className="flex gap-2">
                <Input placeholder="ID da categoria com canais de voz" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-11 border-border bg-secondary/40 font-mono text-sm" disabled={!activeToken} />
                <ChannelPicker onSelect={setCategoryId} disabled={!activeToken} type="category" />
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
            <AlertTriangle size={16} className="shrink-0 text-yellow-400" />
            <span className="text-xs text-yellow-400">O usuário será movido rapidamente entre todos os canais de voz da categoria. O usuário precisa estar em um canal de voz.</span>
          </div>
          <div className="mt-6">
            <Button onClick={handleStart} disabled={starting || !activeToken || !userId.trim() || !categoryId.trim()} className="h-11 w-full bg-yellow-600 text-white hover:bg-yellow-700">
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Anchor size={18} className="mr-2" />}
              Iniciar Elevador
            </Button>
          </div>
        </div>
      </div>
    )
  }
  if (phase === "running") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 animate-ping rounded-full bg-yellow-500/20" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/20">
                <Anchor size={24} className="text-yellow-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-400">Elevador ativo</h3>
              <p className="text-sm text-muted-foreground">{status}</p>
              {username && <p className="text-xs text-muted-foreground mt-1">Alvo: {username}</p>}
            </div>
            <Button onClick={handleStop} variant="destructive" className="h-10">
              <StopCircle size={16} className="mr-2" /> Parar
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
            <div className="flex-1"><h3 className="text-lg font-semibold text-green-400">Elevador encerrado</h3></div>
            <Button onClick={handleReset} variant="outline" className="h-10">Voltar</Button>
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
            <Button onClick={handleReset} variant="outline" className="h-10">Tentar novamente</Button>
          </div>
        </div>
      </div>
    )
  }
  return null
}
