
import { useState, useEffect, useCallback, type ReactNode } from "react"
import { useParams } from "react-router-dom"
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Clock,
  Users,
  TrendingUp,
  Loader2,
  Calendar,
  Trophy,
  Award,
  Medal,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  Volume2,
  VolumeX,
  ShieldAlert,
  ArrowRightLeft,
  ChevronDown,
  Activity,
  Radio,
  Hash,
  Server,
  Copy,
  UserCircle,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { api } from "@/lib/api-client"
import type { CallSession, DailyCallStat, VoiceEventType, VoiceEvent, CallParticipant } from "@/types/monitoring"
import { useWSEvent } from "@/hooks/use-websocket"

function formatDuration(ms: number): string {
  if (ms <= 0) return "0s"
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDate(ts: string): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateShort(ts: string): string {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function getDefaultAvatar(userId: string): string {
  const idx = parseInt(userId.slice(-1)) % 5
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
}

interface EventVisual {
  icon: ReactNode
  label: string
  color: string
  bg: string
}

const EVENT_VISUALS: Record<VoiceEventType, EventVisual> = {
  join:          { icon: <PhoneIncoming size={13} />, label: "Entrou na call",        color: "text-emerald-400", bg: "bg-emerald-500/15" },
  leave:         { icon: <PhoneOff size={13} />,      label: "Saiu da call",           color: "text-red-400",     bg: "bg-red-500/15" },
  move:          { icon: <ArrowRightLeft size={13} />,label: "Mudou de canal",         color: "text-blue-400",    bg: "bg-blue-500/15" },
  mute:          { icon: <MicOff size={13} />,        label: "Mutou o microfone",      color: "text-orange-400",  bg: "bg-orange-500/15" },
  unmute:        { icon: <Mic size={13} />,           label: "Desmutou o microfone",   color: "text-emerald-400", bg: "bg-emerald-500/15" },
  deaf:          { icon: <VolumeX size={13} />,       label: "Ensurdeceu",             color: "text-orange-400",  bg: "bg-orange-500/15" },
  undeaf:        { icon: <Volume2 size={13} />,       label: "Desensurdeceu",          color: "text-emerald-400", bg: "bg-emerald-500/15" },
  camera_on:     { icon: <Video size={13} />,         label: "Ligou a câmera",         color: "text-violet-400",  bg: "bg-violet-500/15" },
  camera_off:    { icon: <VideoOff size={13} />,      label: "Desligou a câmera",      color: "text-zinc-400",    bg: "bg-zinc-500/15" },
  screen_on:     { icon: <Monitor size={13} />,       label: "Compartilhou a tela",    color: "text-cyan-400",    bg: "bg-cyan-500/15" },
  screen_off:    { icon: <MonitorOff size={13} />,    label: "Parou de compartilhar",  color: "text-zinc-400",    bg: "bg-zinc-500/15" },
  server_mute:   { icon: <ShieldAlert size={13} />,   label: "Mutado pelo servidor",   color: "text-red-400",     bg: "bg-red-500/15" },
  server_unmute: { icon: <Mic size={13} />,           label: "Desmutado pelo servidor", color: "text-teal-400",   bg: "bg-teal-500/15" },
  server_deaf:   { icon: <ShieldAlert size={13} />,   label: "Ensurdecido pelo servidor", color: "text-red-400",  bg: "bg-red-500/15" },
  server_undeaf: { icon: <Volume2 size={13} />,       label: "Desensurdecido pelo servidor", color: "text-teal-400", bg: "bg-teal-500/15" },
}

function EventBadge({ event }: { event: VoiceEvent }) {
  const v = EVENT_VISUALS[event.type] || { icon: <Activity size={13} />, label: event.type, color: "text-zinc-400", bg: "bg-zinc-500/15" }
  return (
    <div className="flex items-center gap-2.5 group">
      <div className="flex flex-col items-center gap-0">
        <div className={`rounded-full p-1.5 ${v.bg} ring-2 ring-background`}>
          <span className={v.color}>{v.icon}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${v.color}`}>{v.label}</span>
          <span className="text-[10px] text-muted-foreground/60">{event.username}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-mono">{formatTime(event.timestamp)}</span>
          <span className="text-[10px] text-muted-foreground/40">#{event.channelName}</span>
        </div>
      </div>
    </div>
  )
}

function EventSummaryPills({ events }: { events: VoiceEvent[] }) {
  const counts = new Map<VoiceEventType, number>()
  for (const e of events) counts.set(e.type, (counts.get(e.type) || 0) + 1)

  const pills: { type: VoiceEventType; count: number }[] = []
  for (const [type, count] of counts) pills.push({ type, count })

  const order: VoiceEventType[] = [
    "join", "leave", "move",
    "camera_on", "camera_off", "screen_on", "screen_off",
    "mute", "unmute", "deaf", "undeaf",
    "server_mute", "server_unmute", "server_deaf", "server_undeaf",
  ]
  pills.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map(({ type, count }) => {
        const v = EVENT_VISUALS[type]
        return (
          <div
            key={type}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 ${v.bg} border border-transparent`}
            title={v.label}
          >
            <span className={v.color}>{v.icon}</span>
            <span className={`text-[10px] font-medium ${v.color}`}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function ParticipantAvatar({ participant, size = 32 }: { participant: CallParticipant; size?: number }) {
  const src = participant.avatarUrl || getDefaultAvatar(participant.userId)
  return (
    <img
      src={src}
      alt={participant.username}
      className="rounded-full object-cover bg-muted shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).src = getDefaultAvatar(participant.userId)
      }}
    />
  )
}

function ParticipantCard({ participant }: { participant: CallParticipant }) {
  const [copied, setCopied] = useState(false)

  const copyId = () => {
    navigator.clipboard.writeText(participant.userId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const isActive = !participant.leftAt

  return (
    <div className={`rounded-xl border ${isActive ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/30 bg-card/50"} p-3 transition-all hover:border-border/60`}>
      <div className="flex items-center gap-3">
        <div className="relative">
          <ParticipantAvatar participant={participant} size={40} />
          {isActive && (
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{participant.globalName || participant.username}</p>
            {participant.globalName && participant.globalName !== participant.username && (
              <span className="text-[10px] text-muted-foreground/60 truncate">@{participant.username}</span>
            )}
          </div>
          <button
            onClick={copyId}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors group/id"
          >
            <span className="font-mono">{participant.userId}</span>
            <Copy size={9} className="opacity-0 group-hover/id:opacity-100 transition-opacity" />
            {copied && <span className="text-emerald-400 text-[9px]">copiado!</span>}
          </button>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-mono font-bold">{formatDuration(participant.totalTime)}</p>
          {isActive && (
            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">AO VIVO</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <PhoneIncoming size={9} className="text-emerald-400" />
          {formatTime(participant.joinedAt)}
        </span>
        {participant.leftAt && (
          <>
            <span className="text-muted-foreground/30">—</span>
            <span className="flex items-center gap-1">
              <PhoneOff size={9} className="text-red-400" />
              {formatTime(participant.leftAt)}
            </span>
          </>
        )}
        <span className="ml-auto text-muted-foreground/50">{participant.events.length} eventos</span>
      </div>
      {participant.events.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/20">
          <EventSummaryPills events={participant.events} />
        </div>
      )}
    </div>
  )
}

const PIE_COLORS = ["#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#f43f5e", "#ec4899", "#14b8a6"]
const RANK_ICONS = [
  <Trophy size={14} className="text-amber-400" key="1" />,
  <Award size={14} className="text-zinc-300" key="2" />,
  <Medal size={14} className="text-amber-600" key="3" />,
]

export default function CallsPage() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<CallSession[]>([])
  const [dailyStats, setDailyStats] = useState<DailyCallStat[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, dailyRes] = await Promise.all([
        api.getUserSessions(userId, 200),
        api.getDailyCallStats(userId, 14),
      ])
      setSessions((sessionsRes.data || []) as CallSession[])
      setDailyStats((dailyRes.data || []) as DailyCallStat[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<CallSession>("monitoring:session_start", (session) => {
    if (session.userId === userId) {
      setSessions(prev => {
        if (prev.some(s => s.id === session.id)) return prev
        return [session, ...prev]
      })
    }
  })

  useWSEvent<CallSession>("monitoring:session_end", (session) => {
    if (session.userId === userId) {
      setSessions(prev => prev.map(s => s.id === session.id ? session : s))
    }
  })

  useWSEvent<VoiceEvent>("monitoring:voice_event", (event) => {
    if (event.userId === userId || sessions.some(s => s.active && s.participants.some(p => p.userId === event.userId))) {
      fetchData()
    }
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const activeSessions = sessions.filter(s => s.active)
  const completedSessions = sessions.filter(s => !s.active)
  const totalCalls = sessions.length
  const totalTime = sessions.reduce((acc, s) => acc + s.totalDuration, 0)
  const avgDuration = totalCalls > 0 ? totalTime / totalCalls : 0
  const allParticipants = sessions.flatMap(s => s.participants)
  const uniqueParticipantIds = new Set(allParticipants.map(p => p.userId))
  const uniqueParticipants = uniqueParticipantIds.size

  const allEvents = sessions.flatMap(s => s.events)
  const totalMutes = allEvents.filter(e => e.type === "mute").length
  const totalCamOn = allEvents.filter(e => e.type === "camera_on").length
  const totalScreenOn = allEvents.filter(e => e.type === "screen_on").length

  const longestSession = sessions.length > 0 ? sessions.reduce((a, b) => a.totalDuration > b.totalDuration ? a : b) : null

  const participantMap = new Map<string, {
    username: string
    avatar: string | null
    avatarUrl?: string
    globalName?: string | null
    totalTime: number
    count: number
    lastSeen: string
  }>()
  for (const s of sessions) {
    for (const p of s.participants) {
      const entry = participantMap.get(p.userId) || {
        username: p.username,
        avatar: p.avatar,
        avatarUrl: p.avatarUrl,
        globalName: p.globalName,
        totalTime: 0,
        count: 0,
        lastSeen: p.joinedAt,
      }
      entry.totalTime += p.totalTime
      entry.count++
      if (p.joinedAt > entry.lastSeen) entry.lastSeen = p.joinedAt
      if (p.avatarUrl) entry.avatarUrl = p.avatarUrl
      if (p.globalName) entry.globalName = p.globalName
      entry.username = p.username
      participantMap.set(p.userId, entry)
    }
  }
  const leaderboard = Array.from(participantMap.entries())
    .map(([uid, data]) => ({ userId: uid, ...data }))
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 15)

  const guildMap = new Map<string, { name: string; icon: string | null; count: number; totalTime: number }>()
  for (const s of sessions) {
    const entry = guildMap.get(s.guildId) || { name: s.guildName, icon: s.guildIcon, count: 0, totalTime: 0 }
    entry.count++
    entry.totalTime += s.totalDuration
    guildMap.set(s.guildId, entry)
  }
  const distributionData = Array.from(guildMap.entries())
    .map(([, data]) => ({ name: data.name, icon: data.icon, value: data.count, totalTime: data.totalTime }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)

  const chartData = dailyStats.map(d => ({
    date: formatDateShort(d.date),
    minutos: Math.round(d.totalTime / 60000),
    calls: d.count,
  }))

  const stats = [
    { icon: <Phone size={16} />,       label: "Total de Calls",   value: totalCalls,               color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <Clock size={16} />,       label: "Tempo Total",      value: formatDuration(totalTime), color: "text-blue-400",    bg: "bg-blue-500/10" },
    { icon: <TrendingUp size={16} />,  label: "Média por Call",   value: formatDuration(avgDuration), color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <Users size={16} />,       label: "Participantes",    value: uniqueParticipants,        color: "text-amber-400",   bg: "bg-amber-500/10" },
    { icon: <MicOff size={16} />,      label: "Vezes Mutou",      value: totalMutes,                color: "text-orange-400",  bg: "bg-orange-500/10" },
    { icon: <Video size={16} />,       label: "Ligou Câmera",     value: totalCamOn,                color: "text-violet-400",  bg: "bg-violet-500/10" },
    { icon: <Monitor size={16} />,     label: "Compartilhou Tela", value: totalScreenOn,            color: "text-cyan-400",    bg: "bg-cyan-500/10" },
    { icon: <Activity size={16} />,    label: "Total Eventos",    value: allEvents.length,          color: "text-pink-400",    bg: "bg-pink-500/10" },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {activeSessions.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-emerald-400">Sessões Ativas Agora</h3>
            <span className="text-[10px] text-emerald-400/60 ml-auto">{activeSessions.length} ao vivo</span>
          </div>
          {activeSessions.map(session => (
            <div key={session.id} className="px-4 py-3 border-b border-emerald-500/10 last:border-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Hash size={12} className="text-emerald-400" />
                    <p className="text-sm font-semibold">{session.channelName}</p>
                    <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">AO VIVO</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {session.guildIcon ? <img src={session.guildIcon} alt="" className="w-4 h-4 rounded-full" /> : <Server size={12} className="text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground">{session.guildName}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs text-muted-foreground">Início: {formatTime(session.startedAt)}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-xs font-mono font-semibold text-emerald-400">{formatDuration(session.totalDuration)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {session.participants.map(p => (
                  <div key={p.userId} className="flex items-center gap-2 rounded-lg bg-background/40 border border-border/20 px-2.5 py-1.5">
                    <div className="relative">
                      <ParticipantAvatar participant={p} size={28} />
                      {!p.leftAt && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate max-w-[100px]">{p.globalName || p.username}</p>
                      <p className="text-[9px] font-mono text-muted-foreground">{formatDuration(p.totalTime)}</p>
                    </div>
                  </div>
                ))}
              </div>
              {session.events.length > 0 && (
                <div className="mt-2">
                  <EventSummaryPills events={session.events} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/40 bg-card/50 p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${s.bg}`}>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <Calendar size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold">Tempo em Call por Dia</h3>
          </div>
          <div className="p-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#666" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#666" }} tickFormatter={(v) => `${v}min`} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#aaa" }}
                    formatter={(value: number, name: string) => [name === "calls" ? `${value} calls` : `${value} min`, name === "calls" ? "Calls" : "Tempo"]}
                  />
                  <Bar dataKey="minutos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="calls" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-56 flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="px-4 py-3 border-b border-border/20">
            <h3 className="text-sm font-semibold">Por Servidor</h3>
          </div>
          <div className="p-4">
            {distributionData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie data={distributionData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                      {distributionData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                      formatter={(value: number, name: string) => [`${value} calls`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 w-full">
                  {distributionData.map((d, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {d.icon ? <img src={d.icon} alt="" className="w-3 h-3 rounded-full" /> : null}
                      <span className="text-muted-foreground truncate max-w-[80px]">{d.name}</span>
                      <span className="text-muted-foreground/40">({formatDuration(d.totalTime)})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <Trophy size={14} className="text-amber-400" />
            <h3 className="text-sm font-semibold">Mais Tempo em Call</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">{leaderboard.length} participantes</span>
          </div>
          <div className="p-2">
            {leaderboard.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhum participante</p>
            ) : (
              <div className="space-y-0.5">
                {leaderboard.map((p, i) => (
                  <div key={p.userId} className="flex items-center gap-3 rounded-lg hover:bg-muted/30 px-3 py-2 transition-colors group">
                    <span className="w-6 flex justify-center shrink-0">
                      {i < 3 ? RANK_ICONS[i] : <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>}
                    </span>
                    <img
                      src={p.avatarUrl || getDefaultAvatar(p.userId)}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover bg-muted shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = getDefaultAvatar(p.userId) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.globalName || p.username}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{p.count} calls</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="font-mono opacity-0 group-hover:opacity-100 transition-opacity">{p.userId}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-semibold text-muted-foreground">{formatDuration(p.totalTime)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {longestSession && (
            <div className="rounded-xl border border-border/40 bg-card/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy size={14} className="text-violet-400" />
                <h3 className="text-sm font-semibold">Sessão Mais Longa</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-lg font-mono font-bold">{formatDuration(longestSession.totalDuration)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Hash size={10} />
                    <span>{longestSession.channelName}</span>
                    <span className="text-muted-foreground/30">·</span>
                    {longestSession.guildIcon ? <img src={longestSession.guildIcon} alt="" className="w-3.5 h-3.5 rounded-full" /> : <Server size={10} />}
                    <span>{longestSession.guildName}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(longestSession.startedAt)} — {longestSession.participants.length} participante(s)</p>
                </div>
                <div className="flex -space-x-2">
                  {longestSession.participants.slice(0, 5).map(p => (
                    <img
                      key={p.userId}
                      src={p.avatarUrl || getDefaultAvatar(p.userId)}
                      alt={p.username}
                      className="w-7 h-7 rounded-full border-2 border-background object-cover bg-muted"
                      title={p.globalName || p.username}
                      onError={(e) => { (e.target as HTMLImageElement).src = getDefaultAvatar(p.userId) }}
                    />
                  ))}
                  {longestSession.participants.length > 5 && (
                    <div className="w-7 h-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">+{longestSession.participants.length - 5}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border/40 bg-card/50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
              <Radio size={14} className="text-pink-400" />
              <h3 className="text-sm font-semibold">Legenda de Eventos</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-2">
              {(Object.entries(EVENT_VISUALS) as [VoiceEventType, EventVisual][]).map(([type, v]) => (
                <div key={type} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-muted/20 transition-colors">
                  <div className={`rounded-full p-1 ${v.bg}`}>
                    <span className={v.color}>{v.icon}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
          <Clock size={14} className="text-blue-400" />
          <h3 className="text-sm font-semibold">Histórico de Sessões</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{completedSessions.length} sessões</span>
        </div>
        <div className="divide-y divide-border/20">
          {completedSessions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma call registrada</p>
          ) : (
            completedSessions.slice(0, 50).map(session => {
              const isExpanded = expandedSession === session.id
              return (
                <div key={session.id} className="group">
                  <button
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="w-2 h-2 rounded-full shrink-0 bg-zinc-600" />

                    <div className="flex -space-x-1.5 shrink-0">
                      {session.participants.slice(0, 4).map(p => (
                        <img
                          key={p.userId}
                          src={p.avatarUrl || getDefaultAvatar(p.userId)}
                          alt={p.username}
                          className="w-6 h-6 rounded-full border-2 border-background object-cover bg-muted"
                          title={p.globalName || p.username}
                          onError={(e) => { (e.target as HTMLImageElement).src = getDefaultAvatar(p.userId) }}
                        />
                      ))}
                      {session.participants.length > 4 && (
                        <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">+{session.participants.length - 4}</div>
                      )}
                      {session.participants.length === 0 && (
                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                          <UserCircle size={14} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Hash size={11} className="text-muted-foreground shrink-0" />
                        <p className="text-sm font-medium truncate">{session.channelName}</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                        {session.guildIcon ? <img src={session.guildIcon} alt="" className="w-3.5 h-3.5 rounded-full" /> : <Server size={10} />}
                        <span className="truncate">{session.guildName}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <Users size={10} className="shrink-0" />
                        <span>{session.participants.length}</span>
                        <span className="text-muted-foreground/40">·</span>
                        <Activity size={10} className="shrink-0" />
                        <span>{session.events.length}</span>
                      </div>
                    </div>

                    <div className="hidden md:block shrink-0 max-w-[300px]">
                      <EventSummaryPills events={session.events} />
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <p className="text-sm font-mono font-semibold">{formatDuration(session.totalDuration)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDate(session.startedAt)} {formatTime(session.startedAt)}
                      </p>
                    </div>

                    <ChevronDown size={14} className={`text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-muted/5">
                      <div className="md:hidden mb-3 pt-2">
                        <EventSummaryPills events={session.events} />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 pt-2">
                        <div className="rounded-lg bg-background/50 border border-border/20 p-2 text-center">
                          <p className="text-xs text-muted-foreground">Início</p>
                          <p className="text-sm font-mono font-semibold">{formatTime(session.startedAt)}</p>
                        </div>
                        <div className="rounded-lg bg-background/50 border border-border/20 p-2 text-center">
                          <p className="text-xs text-muted-foreground">Fim</p>
                          <p className="text-sm font-mono font-semibold">{session.endedAt ? formatTime(session.endedAt) : "—"}</p>
                        </div>
                        <div className="rounded-lg bg-background/50 border border-border/20 p-2 text-center">
                          <p className="text-xs text-muted-foreground">Duração</p>
                          <p className="text-sm font-mono font-semibold">{formatDuration(session.totalDuration)}</p>
                        </div>
                        <div className="rounded-lg bg-background/50 border border-border/20 p-2 text-center">
                          <p className="text-xs text-muted-foreground">Eventos</p>
                          <p className="text-sm font-mono font-semibold">{session.events.length}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                          <div className="flex items-center gap-2 mb-3">
                            <Activity size={12} className="text-violet-400" />
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h4>
                            <span className="text-[10px] text-muted-foreground/50 ml-auto">{session.events.length} eventos</span>
                          </div>
                          {session.events.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center">Nenhum evento</p>
                          ) : (
                            <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                              {session.events.map((event, i) => (
                                <div key={`${event.id || i}`} className="relative flex items-start">
                                  {i < session.events.length - 1 && (
                                    <div className="absolute left-[13px] top-[28px] w-[1.5px] h-[calc(100%)] bg-border/30" />
                                  )}
                                  <div className="relative z-10 w-full">
                                    <EventBadge event={event} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Users size={12} className="text-amber-400" />
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Participantes</h4>
                          </div>
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {session.participants.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-4 text-center">Nenhum participante</p>
                            ) : (
                              session.participants.map(p => (
                                <ParticipantCard key={p.userId} participant={p} />
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
