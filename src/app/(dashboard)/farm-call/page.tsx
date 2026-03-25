
import { useState, useEffect, useRef } from "react"
import {
  Timer,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  StopCircle,
  Radio,
  Mic,
  MicOff,
  EarOff,
  Ear,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChannelPicker } from "@/components/channel-picker"
import { useTokens } from "@/hooks/use-tokens"
import { useWSEvent } from "@/hooks/use-websocket"
import { api } from "@/lib/api-client"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"
import type { ToolTask } from "@/types/tools"

type Phase = "idle" | "running" | "completed" | "error"

interface ChannelMember {
  userId: string
  username: string
  avatar: string | null
}

export default function PaginaFarmCall() {
  const { activeToken } = useTokens()
  const [channelId, setChannelId] = useState("")
  const [selfMute, setSelfMute] = useState(false)
  const [selfDeaf, setSelfDeaf] = useState(false)
  const [starting, setStarting] = useState(false)
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState("")
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [elapsed, setElapsed] = useState(0)
  const [guildName, setGuildName] = useState("")
  const [guildIcon, setGuildIcon] = useState<string | null>(null)
  const [channelName, setChannelName] = useState("")
  const [isMuted, setIsMuted] = useState(false)
  const [isDeaf, setIsDeaf] = useState(false)
  const [members, setMembers] = useState<Map<string, ChannelMember>>(new Map())
  const startTime = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api.getTasks().then(res => {
      const tasks = ((res as any).data || []) as ToolTask[]
      const running = tasks.find(t =>
        (t.status === 'running' || t.status === 'paused') &&
        t.tool === 'call-utils' &&
        (t.config as any)?.subAction === 'farm-hours'
      )
      if (running) {
        setTaskId(running.id)
        setChannelName((running.config as any)?.channelName || '')
        setGuildName((running.config as any)?.guildName || '')
        setGuildIcon((running.config as any)?.guildIcon || null)
        setIsMuted((running.config as any)?.selfMute ?? false)
        setIsDeaf((running.config as any)?.selfDeaf ?? false)
        startTime.current = new Date(running.startedAt).getTime()
        setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
        if (running.results?.length > 0) {
          setStatus(running.results[running.results.length - 1].message)
        }
        timerRef.current = setInterval(() => {
          setElapsed(Math.floor((Date.now() - (startTime.current ?? Date.now())) / 1000))
        }, 1000)
        setPhase('running')
      }
    }).catch(() => {})
  }, [])

  useWSEvent<{
    taskId: string
    userId: string
    username: string
    avatar: string | null
    speaking: boolean
  }>("audio:speaking", (data) => {
    if (data.taskId !== taskId) return
    setMembers(prev => {
      const next = new Map(prev)
      if (data.speaking) {
        next.set(data.userId, { userId: data.userId, username: data.username, avatar: data.avatar })
      } else {
        next.delete(data.userId)
      }
      return next
    })
  })

  useWSEvent<WSToolProgress>("tool:progress", (data) => {
    if (data.taskId !== taskId) return
    if (data.message) setStatus(data.message)
  })

  useWSEvent<WSToolCompleted>("tool:completed", (data) => {
    if (data.taskId !== taskId) return
    setPhase("completed")
    if (timerRef.current) clearInterval(timerRef.current)
  })

  useWSEvent<WSToolError>("tool:error", (data) => {
    if (data.taskId !== taskId) return
    setError((data as any).error || "Erro desconhecido")
    setPhase("error")
    if (timerRef.current) clearInterval(timerRef.current)
  })

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const handleStart = async () => {
    if (!activeToken || !channelId.trim()) return
    setStarting(true)
    setError("")
    try {
      const res = await api.runTool("call-utils", {
        tokenId: activeToken.id,
        action: "farm-hours",
        channelId: channelId.trim(),
        selfMute,
        selfDeaf,
      })
      const data = res.data as { taskId: string; channel: string; guild: string; guildId: string; guildIcon: string | null; selfMute: boolean; selfDeaf: boolean }
      setTaskId(data.taskId)
      setChannelName(data.channel)
      setGuildName(data.guild || '')
      setGuildIcon(data.guildIcon || null)
      setIsMuted(data.selfMute)
      setIsDeaf(data.selfDeaf)
      setStatus(`Farmando em ${data.channel}...`)
      setPhase("running")
      startTime.current = Date.now()
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (startTime.current ?? Date.now())) / 1000))
      }, 1000)
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
      if (timerRef.current) clearInterval(timerRef.current)
    } catch {}
  }

  const handleToggleMute = async () => {
    if (!taskId) return
    const newMute = !isMuted
    try {
      await api.patch(`/tools/call-utils/${taskId}/mute`, { mute: newMute })
      setIsMuted(newMute)
    } catch {}
  }

  const handleToggleDeaf = async () => {
    if (!taskId) return
    const newDeaf = !isDeaf
    try {
      await api.patch(`/tools/call-utils/${taskId}/deaf`, { deaf: newDeaf })
      setIsDeaf(newDeaf)
    } catch {}
  }

  const handleReset = () => {
    setPhase("idle"); setError(""); setTaskId(null); setStatus(""); setElapsed(0)
    setGuildName(""); setGuildIcon(null); setChannelName(""); setMembers(new Map())
    startTime.current = null
  }

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
  }

  const fmtWords = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m ${sec}s`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }

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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10">
              <Timer size={18} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Farm Call</h2>
              <p className="text-xs text-muted-foreground">Entra em um canal de voz e fica online farmando horas</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ID do Canal de Voz</label>
              <div className="flex gap-2">
                <Input placeholder="ID do canal de voz" value={channelId} onChange={(e) => setChannelId(e.target.value)} className="h-11 border-border bg-secondary/40 font-mono text-sm" disabled={!activeToken} />
                <ChannelPicker onSelect={setChannelId} disabled={!activeToken} type="voice" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-secondary/20 px-4 py-3">
                <button
                  onClick={() => setSelfMute(!selfMute)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    selfMute ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"
                  }`}
                >
                  {selfMute ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selfMute ? "Mutado" : "Desmutado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selfMute ? "Mic desligado" : "Mic ligado"}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 items-center gap-3 rounded-lg border border-border bg-secondary/20 px-4 py-3">
                <button
                  onClick={() => setSelfDeaf(!selfDeaf)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    selfDeaf ? "bg-yellow-500/10 text-yellow-400" : "bg-green-500/10 text-green-400"
                  }`}
                >
                  {selfDeaf ? <EarOff size={18} /> : <Ear size={18} />}
                </button>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {selfDeaf ? "Ensurdecido" : "Ouvindo"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selfDeaf ? "Áudio desligado" : "Áudio ligado"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button onClick={handleStart} disabled={starting || !activeToken || !channelId.trim()} className="h-11 w-full bg-green-600 text-white hover:bg-green-700">
              {starting ? <Loader2 size={18} className="mr-2 animate-spin" /> : <Timer size={18} className="mr-2" />}
              Iniciar Farm
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
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-emerald-500/3 to-transparent" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-secondary/40 overflow-hidden border border-border/50 flex items-center justify-center shrink-0">
                    {guildIcon ? (
                      <img src={guildIcon} alt={guildName} className="h-full w-full object-cover" />
                    ) : (
                      <Timer size={24} className="text-green-400" />
                    )}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-green-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{guildName || 'Servidor'}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Radio size={12} className="text-green-400" />
                    {channelName || 'Canal de voz'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleToggleMute} variant="outline" size="sm" className={`h-9 ${isMuted ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
                  {isMuted ? <MicOff size={16} className="mr-1.5" /> : <Mic size={16} className="mr-1.5" />}
                  {isMuted ? 'Mutado' : 'Desmutado'}
                </Button>
                <Button onClick={handleToggleDeaf} variant="outline" size="sm" className={`h-9 ${isDeaf ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
                  {isDeaf ? <EarOff size={16} className="mr-1.5" /> : <Ear size={16} className="mr-1.5" />}
                  {isDeaf ? 'Surdo' : 'Ouvindo'}
                </Button>
                <Button onClick={handleStop} variant="outline" size="sm" className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300">
                  <StopCircle size={16} className="mr-1.5" /> Parar
                </Button>
              </div>
            </div>
          </div>
          <div className="px-6 pb-4">
            <div className="rounded-xl bg-secondary/10 border border-border/30 p-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping rounded-full bg-green-500/30" />
                  <div className="relative h-2.5 w-2.5 rounded-full bg-green-500" />
                </div>
                <span className="text-xs font-medium uppercase tracking-widest text-green-400">Farmando</span>
              </div>
              <p className="text-center text-4xl font-bold font-mono text-foreground tracking-wider">
                {fmt(elapsed)}
              </p>
              <p className="text-center text-xs text-muted-foreground mt-2">{fmtWords(elapsed)} no canal de voz</p>
            </div>
          </div>

          {members.size > 0 && (
            <div className="px-6 pb-6">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Na Call ({members.size})</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(members.values()).map((user) => (
                  <div key={user.userId} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.username} className="h-5 w-5 rounded-full" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-secondary" />
                    )}
                    <span className="text-xs font-medium text-foreground">{user.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }
  if (phase === "completed") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-secondary/40 overflow-hidden border border-border/50 flex items-center justify-center shrink-0">
              {guildIcon ? (
                <img src={guildIcon} alt={guildName} className="h-full w-full object-cover" />
              ) : (
                <CheckCircle2 size={24} className="text-green-400" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-400">Farm encerrado</h3>
              <p className="text-sm text-muted-foreground">
                {guildName && <>{guildName} &bull; </>}
                {channelName && <>{channelName} &bull; </>}
                {fmtWords(elapsed)}
              </p>
            </div>
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
