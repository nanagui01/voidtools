
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  MessageSquare,
  Trash2,
  AtSign,
  ImageIcon,
  Phone,
  Clock,
  Users,
  Server,
  Activity,
  Loader2,
  TrendingUp,
  Mic,
  MicOff,
  Video,
  Monitor,
  Headphones,
  PhoneOff,
  ArrowRightLeft,
  Eye,
  EyeOff,
  Hash,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { api } from "@/lib/api-client"
import type { UserMonitoringStats, CallSession, VoiceEvent, MonitoredMessage } from "@/types/monitoring"
import { useWSEvent } from "@/hooks/use-websocket"

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d atrás`
  if (h > 0) return `${h}h atrás`
  if (m > 0) return `${m}min atrás`
  return "agora"
}

const EVENT_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  join: { icon: <Phone size={11} />, label: "Entrou na call", color: "text-emerald-400" },
  leave: { icon: <PhoneOff size={11} />, label: "Saiu da call", color: "text-red-400" },
  move: { icon: <ArrowRightLeft size={11} />, label: "Mudou de canal", color: "text-blue-400" },
  camera_on: { icon: <Video size={11} />, label: "Câmera ligada", color: "text-cyan-400" },
  camera_off: { icon: <Video size={11} />, label: "Câmera desligada", color: "text-zinc-400" },
  screen_on: { icon: <Monitor size={11} />, label: "Compartilhando tela", color: "text-violet-400" },
  screen_off: { icon: <Monitor size={11} />, label: "Parou de compartilhar", color: "text-zinc-400" },
  mute: { icon: <MicOff size={11} />, label: "Mutou", color: "text-amber-400" },
  unmute: { icon: <Mic size={11} />, label: "Desmutou", color: "text-emerald-400" },
  deaf: { icon: <Headphones size={11} />, label: "Ensurdeceu", color: "text-red-400" },
  undeaf: { icon: <Headphones size={11} />, label: "Desensurdeceu", color: "text-emerald-400" },
  server_mute: { icon: <MicOff size={11} />, label: "Mutado pelo server", color: "text-orange-400" },
  server_unmute: { icon: <Mic size={11} />, label: "Desmutado pelo server", color: "text-emerald-400" },
  server_deaf: { icon: <EyeOff size={11} />, label: "Ensurdecido pelo server", color: "text-orange-400" },
  server_undeaf: { icon: <Eye size={11} />, label: "Desensurdecido pelo server", color: "text-emerald-400" },
}

export default function MonitoramentoUserHome() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<UserMonitoringStats | null>(null)
  const [recentSessions, setRecentSessions] = useState<CallSession[]>([])
  const [recentEvents, setRecentEvents] = useState<VoiceEvent[]>([])
  const [recentMessages, setRecentMessages] = useState<MonitoredMessage[]>([])
  const [, setTick] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, sessionsRes, logsRes, msgsRes] = await Promise.all([
        api.getUserMonitoringStats(userId),
        api.getUserSessions(userId, 10),
        api.getUserMonitoringLogs(userId),
        api.getUserMessages(userId, undefined, 20),
      ])
      setStats(statsRes.data as UserMonitoringStats)
      setRecentSessions((sessionsRes.data || []) as CallSession[])
      setRecentEvents((logsRes.data || []) as VoiceEvent[])
      setRecentMessages((msgsRes.data || []) as MonitoredMessage[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<VoiceEvent>("monitoring:voice_event", (event) => {
    if (event.userId === userId) {
      setRecentEvents(prev => [event, ...prev].slice(0, 50))
    }

    setRecentSessions(prev => prev.map(s => {
      if (!s.active) return s

      const isParticipant = s.participants.some(p => p.userId === event.userId)
      const isInSameChannel = s.channelId === event.channelId

      if (event.userId !== userId && !isParticipant && !isInSameChannel) return s

      const now = event.timestamp
      let updatedParticipants = [...s.participants]

      if (event.type === "join" && event.userId !== userId && isInSameChannel) {
        const existing = updatedParticipants.find(p => p.userId === event.userId)
        if (existing) {
          updatedParticipants = updatedParticipants.map(p =>
            p.userId === event.userId
              ? { ...p, joinedAt: now, leftAt: undefined, avatarUrl: event.avatarUrl || p.avatarUrl, globalName: event.globalName || p.globalName, events: [...p.events, event] }
              : p
          )
        } else {
          updatedParticipants.push({
            userId: event.userId,
            username: event.globalName || event.username,
            avatar: null,
            avatarUrl: event.avatarUrl || undefined,
            globalName: event.globalName || null,
            joinedAt: now,
            totalTime: 0,
            events: [event],
          })
        }
      } else if (event.type === "leave" && event.userId !== userId && isParticipant) {
        updatedParticipants = updatedParticipants.map(p =>
          p.userId === event.userId && !p.leftAt
            ? { ...p, leftAt: now, totalTime: p.totalTime + (Date.now() - new Date(p.joinedAt).getTime()), events: [...p.events, event] }
            : p
        )
      }

      return {
        ...s,
        events: [...s.events, event],
        participants: updatedParticipants,
        totalDuration: Date.now() - new Date(s.startedAt).getTime(),
      }
    }))
  })

  useWSEvent<CallSession>("monitoring:session_start", (session) => {
    if (session.userId === userId) {
      setRecentSessions(prev => [session, ...prev.filter(s => s.id !== session.id)].slice(0, 10))
    }
  })

  useWSEvent<CallSession>("monitoring:session_end", (session) => {
    if (session.userId === userId) {
      setRecentSessions(prev => prev.map(s => s.id === session.id ? session : s))
    }
  })

  useWSEvent<MonitoredMessage>("monitoring:message", (msg) => {
    if (msg.userId === userId && msg.eventType === "create") {
      setRecentMessages(prev => [msg, ...prev].slice(0, 20))
    }
  })

  const activeSessions = useMemo(() =>
    recentSessions.filter(s => s.active), [recentSessions]
  )

  useEffect(() => {
    if (activeSessions.length === 0) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeSessions.length])

  const hourlyActivity = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, msgs: 0 }))
    for (const msg of recentMessages) {
      const h = new Date(msg.timestamp).getHours()
      hours[h].msgs++
    }
    return hours
  }, [recentMessages])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statCards = [
    { icon: <MessageSquare size={16} />, label: "Mensagens", value: stats?.totalMessages || 0, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: <Trash2 size={16} />, label: "Deletadas", value: stats?.totalDeleted || 0, color: "text-red-400", bg: "bg-red-500/10" },
    { icon: <Phone size={16} />, label: "Calls", value: stats?.totalCalls || 0, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <Clock size={16} />, label: "Tempo em Call", value: formatDuration(stats?.totalCallTime || 0), color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <ImageIcon size={16} />, label: "Mídias", value: stats?.totalMedia || 0, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { icon: <AtSign size={16} />, label: "Menções", value: stats?.totalMentions || 0, color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: <Users size={16} />, label: "Pessoas", value: stats?.uniqueParticipants || 0, color: "text-pink-400", bg: "bg-pink-500/10" },
    { icon: <Server size={16} />, label: "Servidores", value: stats?.totalServers || 0, color: "text-orange-400", bg: "bg-orange-500/10" },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {activeSessions.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-sm font-semibold text-emerald-400">Em Call Agora</span>
          </div>
          {activeSessions.map(session => (
            <div key={session.id} className="flex items-center justify-between bg-emerald-500/5 rounded-lg px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                {session.guildIcon ? (
                  <img src={session.guildIcon} alt="" className="w-8 h-8 rounded-full shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-emerald-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{session.channelName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{session.guildName}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-mono font-medium text-emerald-400">
                  {formatDuration(Date.now() - new Date(session.startedAt).getTime())}
                </p>
                <div className="flex items-center gap-1 justify-end mt-0.5">
                  <Users size={10} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground">{session.participants.length}</span>
                  <div className="flex -space-x-1.5 ml-1">
                    {session.participants.slice(0, 4).map((p) => (
                      <div key={p.userId} title={p.globalName || p.username}>
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt="" className="w-4 h-4 rounded-full border border-background" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-muted border border-background flex items-center justify-center">
                            <span className="text-[7px] font-bold">{(p.globalName || p.username)?.[0]?.toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    {session.participants.length > 4 && (
                      <div className="w-4 h-4 rounded-full bg-muted border border-background flex items-center justify-center">
                        <span className="text-[7px]">+{session.participants.length - 4}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border/40 bg-card/50 p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${card.bg}`}>
              <span className={card.color}>{card.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {recentMessages.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <TrendingUp size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Atividade de Mensagens (por hora)</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={hourlyActivity}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#888" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "#888" }} allowDecimals={false} width={25} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value}`, "Msgs"]}
                />
                <Bar dataKey="msgs" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <Phone size={14} className="text-emerald-400" />
            <h3 className="text-sm font-semibold">Calls Recentes</h3>
          </div>
          <div className="p-2 max-h-[340px] overflow-y-auto">
            {recentSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma call registrada</p>
            ) : (
              <div className="space-y-1">
                {recentSessions.map(session => (
                  <div
                    key={session.id}
                    className={`rounded-lg px-3 py-2.5 transition-colors ${
                      session.active ? "bg-emerald-500/5 border border-emerald-500/20" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {session.active && (
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                          )}
                          <p className="text-sm font-medium truncate">{session.channelName}</p>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {session.guildIcon ? (
                            <img src={session.guildIcon} alt="" className="w-3 h-3 rounded-full" />
                          ) : (
                            <Server size={9} className="text-muted-foreground" />
                          )}
                          <span className="text-[10px] text-muted-foreground truncate">{session.guildName}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-xs font-mono font-medium ${session.active ? "text-emerald-400" : ""}`}>
                          {session.active
                            ? formatDuration(Date.now() - new Date(session.startedAt).getTime())
                            : formatDuration(session.totalDuration)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(session.startedAt)}</p>
                      </div>
                    </div>
                    {session.participants.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex -space-x-1.5">
                          {session.participants.slice(0, 5).map(p => (
                            <div key={p.userId} title={p.globalName || p.username}>
                              {p.avatarUrl ? (
                                <img src={p.avatarUrl} alt="" className="w-4 h-4 rounded-full border border-background" />
                              ) : (
                                <div className="w-4 h-4 rounded-full bg-muted border border-background flex items-center justify-center">
                                  <span className="text-[7px] font-bold">{(p.globalName || p.username)?.[0]?.toUpperCase()}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {session.participants.length} participante{session.participants.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <Activity size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold">Eventos de Voz</h3>
          </div>
          <div className="p-2 max-h-[340px] overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum evento ainda</p>
            ) : (
              <div className="space-y-0.5">
                {recentEvents.slice(0, 25).map((event, i) => {
                  const cfg = EVENT_CONFIG[event.type] || { icon: <Activity size={11} />, label: event.type, color: "text-muted-foreground" }
                  return (
                    <div key={`ve_${event.id || ''}_${i}`} className="flex items-center gap-2.5 text-xs px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <span className={`shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-[11px] ${cfg.color}`}>{cfg.label}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Hash size={8} className="text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground truncate">{event.channelName}</span>
                          {event.guildIcon && (
                            <img src={event.guildIcon} alt="" className="w-3 h-3 rounded-full ml-1" />
                          )}
                        </div>
                      </div>
                      <span className="text-muted-foreground font-mono text-[10px] shrink-0">{formatTime(event.timestamp)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <MessageSquare size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Mensagens Recentes</h3>
          </div>
          <div className="p-2 max-h-[340px] overflow-y-auto">
            {recentMessages.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma mensagem ainda</p>
            ) : (
              <div className="space-y-0.5">
                {recentMessages.slice(0, 15).map((msg) => (
                  <div key={msg.id} className="px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] leading-relaxed flex-1 min-w-0 line-clamp-2">
                        {msg.content || <span className="text-muted-foreground italic">[sem texto]</span>}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{timeAgo(msg.timestamp)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Hash size={8} /> {msg.channelName}
                      </span>
                      {msg.guildIcon ? (
                        <img src={msg.guildIcon} alt="" className="w-3 h-3 rounded-full" />
                      ) : (
                        <Server size={8} className="text-muted-foreground" />
                      )}
                      <span className="text-[10px] text-muted-foreground truncate">{msg.guildName}</span>
                      {msg.attachments.length > 0 && (
                        <span className="text-[10px] text-cyan-400 flex items-center gap-0.5">
                          <ImageIcon size={8} /> {msg.attachments.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
