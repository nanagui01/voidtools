
import { useState, useEffect, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Phone,
  PhoneOff,
  Camera,
  CameraOff,
  Monitor,
  MonitorOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowRight,
  Clock,
  Users,
  Activity,
  Loader2,
  Radio,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useWSEvent } from "@/hooks/use-websocket"
import { api } from "@/lib/api-client"
import type { CallSession, VoiceEvent, CallParticipant } from "@/types/monitoring"

const EVENT_ICONS: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  join: { icon: <Phone size={14} />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "entrou na call" },
  leave: { icon: <PhoneOff size={14} />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "saiu da call" },
  move: { icon: <ArrowRight size={14} />, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "mudou de canal" },
  camera_on: { icon: <Camera size={14} />, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", label: "ligou a câmera" },
  camera_off: { icon: <CameraOff size={14} />, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20", label: "desligou a câmera" },
  screen_on: { icon: <Monitor size={14} />, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", label: "compartilhou tela" },
  screen_off: { icon: <MonitorOff size={14} />, color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20", label: "parou de compartilhar tela" },
  mute: { icon: <MicOff size={14} />, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", label: "mutou" },
  unmute: { icon: <Mic size={14} />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "desmutou" },
  deaf: { icon: <VolumeX size={14} />, color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", label: "ensurdeceu" },
  undeaf: { icon: <Volume2 size={14} />, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "desensurdeceu" },
  server_mute: { icon: <MicOff size={14} />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "foi mutado pelo servidor" },
  server_unmute: { icon: <Mic size={14} />, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "foi desmutado pelo servidor" },
  server_deaf: { icon: <VolumeX size={14} />, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "foi ensurdecido pelo servidor" },
  server_undeaf: { icon: <Volume2 size={14} />, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "foi desensurdecido pelo servidor" },
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s"
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function calcDurationBetween(startType: string, endType: string, events: VoiceEvent[], userId: string): number {
  let total = 0
  let lastStart: number | null = null
  for (const e of events) {
    if (e.userId !== userId) continue
    if (e.type === startType && lastStart === null) {
      lastStart = new Date(e.timestamp).getTime()
    } else if (e.type === endType && lastStart !== null) {
      total += new Date(e.timestamp).getTime() - lastStart
      lastStart = null
    }
  }
  if (lastStart !== null) {
    total += Date.now() - lastStart
  }
  return total
}

export default function PaginaSessao() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const userId = searchParams.get("userId")
  const sessionId = searchParams.get("sessionId")

  const [session, setSession] = useState<CallSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [showParticipants, setShowParticipants] = useState(true)

  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!session?.active) return
    const int = setInterval(() => forceUpdate(v => v + 1), 1000)
    return () => clearInterval(int)
  }, [session?.active])

  useEffect(() => {
    if (!userId || !sessionId) return
    setLoading(true)
    api.getSessionDetail(userId, sessionId).then(res => {
      setSession(res.data as CallSession)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [userId, sessionId])

  useWSEvent<VoiceEvent>("monitoring:voice_event", (event) => {
    if (!session?.active) return
    if (event.guildId !== session.guildId) return

    setSession(prev => {
      if (!prev) return prev
      const updated = { ...prev, events: [...prev.events, event] }

      if (event.userId !== prev.userId) {
        const pIdx = updated.participants.findIndex(p => p.userId === event.userId)
        if (event.type === "join" && pIdx === -1) {
          updated.participants = [...updated.participants, {
            userId: event.userId,
            username: event.globalName || event.username,
            avatar: null,
            avatarUrl: event.avatarUrl || undefined,
            globalName: event.globalName || null,
            joinedAt: event.timestamp,
            totalTime: 0,
            events: [event],
          }]
        } else if (pIdx >= 0) {
          const p = { ...updated.participants[pIdx] }
          p.events = [...p.events, event]
          if (event.type === "leave") {
            p.leftAt = event.timestamp
            p.totalTime += new Date(event.timestamp).getTime() - new Date(p.joinedAt).getTime()
          }
          updated.participants = [...updated.participants]
          updated.participants[pIdx] = p
        }
      }

      updated.totalDuration = Date.now() - new Date(updated.startedAt).getTime()
      return updated
    })
  })

  useWSEvent<CallSession>("monitoring:session_end", (ended) => {
    if (ended.id === session?.id) {
      setSession(ended)
    }
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Sessão não encontrada</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/monitoramento")}>
          <ArrowLeft size={14} className="mr-1" /> Voltar
        </Button>
      </div>
    )
  }

  const duration = session.active
    ? Date.now() - new Date(session.startedAt).getTime()
    : session.totalDuration

  const cameraTime = calcDurationBetween("camera_on", "camera_off", session.events, session.userId)
  const screenTime = calcDurationBetween("screen_on", "screen_off", session.events, session.userId)
  const muteTime = calcDurationBetween("mute", "unmute", session.events, session.userId)

  const activeParticipants = session.participants.filter(p => !p.leftAt)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/monitoramento")}>
            <ArrowLeft size={16} />
          </Button>

          <div className="flex items-center gap-3">
            {session.guildIcon ? (
              <img src={session.guildIcon} alt="" className="h-10 w-10 rounded-full ring-2 ring-border" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-zinc-700 ring-2 ring-border flex items-center justify-center text-sm font-bold">
                {session.guildName?.[0]}
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold">{session.guildName}</h1>
              <p className="text-xs text-muted-foreground">#{session.channelName} • {session.username}</p>
            </div>
          </div>

          {session.active ? (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5">
              <Radio size={12} className="text-emerald-400 animate-pulse" />
              <span className="text-sm text-emerald-400 font-bold font-mono">
                {formatDuration(duration)}
              </span>
            </div>
          ) : (
            <div className="ml-auto text-right">
              <p className="text-sm font-medium">{formatDuration(duration)}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatFullDate(session.startedAt)} → {session.endedAt ? formatFullDate(session.endedAt) : "..."}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={12} /> Duração: <span className="text-foreground font-medium">{formatDuration(duration)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Camera size={12} /> Câmera: <span className="text-foreground font-medium">{formatDuration(cameraTime)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Monitor size={12} /> Tela: <span className="text-foreground font-medium">{formatDuration(screenTime)}</span>
          </span>
          <span className="flex items-center gap-1">
            <MicOff size={12} /> Mutado: <span className="text-foreground font-medium">{formatDuration(muteTime)}</span>
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} /> Participantes: <span className="text-foreground font-medium">{session.participants.length}</span>
          </span>
          <span className="flex items-center gap-1">
            <Activity size={12} /> Eventos: <span className="text-foreground font-medium">{session.events.length}</span>
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Activity size={14} className="text-primary" />
              Linha do Tempo
            </h3>

            <div className="relative">
              <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-0">
                {session.events.map((event, i) => {
                  const meta = EVENT_ICONS[event.type] || {
                    icon: <Activity size={14} />,
                    color: "text-zinc-400",
                    bg: "bg-zinc-500/10 border-zinc-500/20",
                    label: event.type,
                  }

                  let durationNote = ""
                  if (event.type === "camera_on" || event.type === "screen_on" || event.type === "mute" || event.type === "deaf") {
                    const offType = event.type.replace("_on", "_off").replace("mute", "unmute").replace("deaf", "undeaf")
                    const nextOff = session.events.slice(i + 1).find(
                      e => e.userId === event.userId && e.type === offType
                    )
                    if (nextOff) {
                      const dur = new Date(nextOff.timestamp).getTime() - new Date(event.timestamp).getTime()
                      durationNote = `(total: ${formatDuration(dur)})`
                    } else if (session.active) {
                      const dur = Date.now() - new Date(event.timestamp).getTime()
                      durationNote = `(${formatDuration(dur)} e contando)`
                    }
                  }

                  if (event.type === "leave") {
                    const joinEvent = [...session.events.slice(0, i)].reverse().find(
                      e => e.userId === event.userId && e.type === "join"
                    )
                    if (joinEvent) {
                      const dur = new Date(event.timestamp).getTime() - new Date(joinEvent.timestamp).getTime()
                      durationNote = `(ficou ${formatDuration(dur)} na call)`
                    }
                  }

                  if (event.type === "camera_off") {
                    const onEvent = [...session.events.slice(0, i)].reverse().find(
                      e => e.userId === event.userId && e.type === "camera_on"
                    )
                    if (onEvent) {
                      const dur = new Date(event.timestamp).getTime() - new Date(onEvent.timestamp).getTime()
                      durationNote = `(ficou ${formatDuration(dur)} com a câmera ligada)`
                    }
                  }

                  if (event.type === "screen_off") {
                    const onEvent = [...session.events.slice(0, i)].reverse().find(
                      e => e.userId === event.userId && e.type === "screen_on"
                    )
                    if (onEvent) {
                      const dur = new Date(event.timestamp).getTime() - new Date(onEvent.timestamp).getTime()
                      durationNote = `(ficou ${formatDuration(dur)} compartilhando tela)`
                    }
                  }

                  if (event.type === "unmute") {
                    const muteEvent = [...session.events.slice(0, i)].reverse().find(
                      e => e.userId === event.userId && e.type === "mute"
                    )
                    if (muteEvent) {
                      const dur = new Date(event.timestamp).getTime() - new Date(muteEvent.timestamp).getTime()
                      durationNote = `(ficou ${formatDuration(dur)} mutado)`
                    }
                  }

                  return (
                    <div key={event.id} className="relative flex gap-4 pb-4">
                      <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${meta.bg}`}>
                        <span className={meta.color}>{meta.icon}</span>
                      </div>

                      <div className="flex-1 pt-1.5">
                        <p className="text-sm">
                          <span className="font-medium">{event.username}</span>{" "}
                          <span className="text-muted-foreground">{meta.label}</span>
                          {durationNote && (
                            <span className="text-xs text-muted-foreground/60 ml-1">{durationNote}</span>
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {formatTime(event.timestamp)} • #{event.channelName}
                        </p>
                      </div>
                    </div>
                  )
                })}

                {!session.active && session.events.length > 0 && (
                  <div className="relative flex gap-4">
                    <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-zinc-500/10 border-zinc-500/20">
                      <Clock size={14} className="text-zinc-400" />
                    </div>
                    <div className="pt-1.5">
                      <p className="text-sm text-muted-foreground">Sessão encerrada</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        Duração total: {formatDuration(duration)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="w-72 border-l border-border flex flex-col overflow-hidden">
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            className="flex items-center gap-2 px-4 py-3 border-b border-border hover:bg-secondary/30 transition-colors text-left"
          >
            <Users size={14} className="text-primary" />
            <span className="text-xs font-semibold flex-1">
              Participantes ({session.participants.length})
            </span>
            {showParticipants ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showParticipants && (
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {session.participants.map((participant) => (
                <ParticipantCard
                  key={participant.userId}
                  participant={participant}
                  sessionActive={session.active}
                  allEvents={session.events}
                />
              ))}

              {session.participants.length === 0 && (
                <div className="flex items-center justify-center h-32">
                  <p className="text-xs text-muted-foreground">Nenhum participante</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ParticipantCard({
  participant,
  sessionActive,
  allEvents,
}: {
  participant: CallParticipant
  sessionActive: boolean
  allEvents: VoiceEvent[]
}) {
  const [copied, setCopied] = useState(false)
  const isInCall = !participant.leftAt
  const totalTime = isInCall && sessionActive
    ? participant.totalTime + (Date.now() - new Date(participant.joinedAt).getTime())
    : participant.totalTime

  const cameraTime = calcDurationBetween("camera_on", "camera_off", allEvents, participant.userId)
  const screenTime = calcDurationBetween("screen_on", "screen_off", allEvents, participant.userId)
  const muteCount = participant.events.filter(e => e.type === "mute").length

  const avatarUrl = participant.avatarUrl
    || (participant.avatar
      ? `https://cdn.discordapp.com/avatars/${participant.userId}/${participant.avatar}.png?size=64`
      : undefined)

  const hasCameraOn = (() => {
    for (let i = participant.events.length - 1; i >= 0; i--) {
      if (participant.events[i].type === "camera_on") return true
      if (participant.events[i].type === "camera_off") return false
    }
    return false
  })()

  const hasScreenOn = (() => {
    for (let i = participant.events.length - 1; i >= 0; i--) {
      if (participant.events[i].type === "screen_on") return true
      if (participant.events[i].type === "screen_off") return false
    }
    return false
  })()

  const copyId = () => {
    navigator.clipboard.writeText(participant.userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${
      isInCall
        ? "border-emerald-500/20 bg-emerald-500/5"
        : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Avatar className="h-7 w-7">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="text-[9px]">{participant.username?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium truncate">{participant.globalName || participant.username}</span>
            {isInCall && hasCameraOn && (
              <span className="flex items-center gap-0.5 text-[8px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded font-medium">
                <Camera size={8} /> Câmera
              </span>
            )}
            {isInCall && hasScreenOn && (
              <span className="flex items-center gap-0.5 text-[8px] text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded font-medium">
                <Monitor size={8} /> Tela
              </span>
            )}
          </div>
          <button
            onClick={copyId}
            className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-foreground transition-colors group/id"
          >
            <span className="font-mono">{participant.userId}</span>
            <Copy size={8} className="opacity-0 group-hover/id:opacity-100 transition-opacity" />
            {copied && <span className="text-emerald-400 text-[8px]">copiado!</span>}
          </button>
        </div>
        {isInCall && <Radio size={8} className="text-emerald-400 animate-pulse shrink-0" />}
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock size={8} /> {formatDuration(totalTime)}
        </span>
        <span className="flex items-center gap-1">
          <Activity size={8} /> {participant.events.length} eventos
        </span>
        {cameraTime > 0 && (
          <span className="flex items-center gap-1 text-blue-400">
            <Camera size={8} /> {formatDuration(cameraTime)}
          </span>
        )}
        {screenTime > 0 && (
          <span className="flex items-center gap-1 text-purple-400">
            <Monitor size={8} /> {formatDuration(screenTime)}
          </span>
        )}
        {muteCount > 0 && (
          <span className="flex items-center gap-1 text-orange-400">
            <MicOff size={8} /> {muteCount}× mutou
          </span>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground/60 mt-1">
        {formatTime(participant.joinedAt)}
        {participant.leftAt ? ` → ${formatTime(participant.leftAt)}` : " → agora"}
      </div>
    </div>
  )
}
