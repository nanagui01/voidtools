
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  Users,
  MessageSquare,
  Clock,
  Server,
  Loader2,
  Hash,
  Phone,
  AtSign,
  BarChart3,
  Copy,
  CheckCheck,
  Trophy,
  TrendingUp,
  Calendar,
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts"
import { api } from "@/lib/api-client"
import type { UserMonitoringStats, InteractionUser, ChannelActivity } from "@/types/monitoring"
import { cn } from "@/lib/utils"

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

const MEDAL_COLORS = ["#facc15", "#94a3b8", "#d97706"]
const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#6366f1", "#14b8a6", "#e879f0"]

export default function InteracoesPage() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<UserMonitoringStats | null>(null)
  const [interactionUsers, setInteractionUsers] = useState<InteractionUser[]>([])
  const [channels, setChannels] = useState<ChannelActivity[]>([])
  const [dailyStats, setDailyStats] = useState<Array<{ date: string; totalTime: number; count: number }>>([])
  const [topTab, setTopTab] = useState<"chat" | "call">("call")
  const [favTab, setFavTab] = useState<"canais" | "servidores">("canais")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, interactionsRes, dailyRes] = await Promise.all([
        api.getUserMonitoringStats(userId),
        api.getUserInteractions(userId),
        api.getDailyCallStats(userId, 7),
      ])
      setStats(statsRes.data as UserMonitoringStats)
      const iData = interactionsRes.data as any
      setInteractionUsers(iData.users || [])
      setChannels(iData.channels || [])
      setDailyStats((dailyRes.data || []) as Array<{ date: string; totalTime: number; count: number }>)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const topByChat = useMemo(() => [...interactionUsers].sort((a, b) => b.messageCount - a.messageCount), [interactionUsers])
  const topByCall = useMemo(() => [...interactionUsers].sort((a, b) => b.callTime - a.callTime), [interactionUsers])

  const totalInteractionMessages = useMemo(() => interactionUsers.reduce((a, u) => a + u.messageCount, 0), [interactionUsers])
  const totalInteractionCallTime = useMemo(() => interactionUsers.reduce((a, u) => a + u.callTime, 0), [interactionUsers])
  const totalMentions = useMemo(() => interactionUsers.reduce((a, u) => a + u.mentionCount, 0), [interactionUsers])

  const serverMap = useMemo(() => {
    const map = new Map<string, { name: string; messageCount: number; callTime: number }>()
    for (const ch of channels) {
      const entry = map.get(ch.guildName) || { name: ch.guildName, messageCount: 0, callTime: 0 }
      entry.messageCount += ch.messageCount
      entry.callTime += ch.callTime
      map.set(ch.guildName, entry)
    }
    return map
  }, [channels])

  const topServers = useMemo(() =>
    Array.from(serverMap.values())
      .sort((a, b) => (b.messageCount + b.callTime / 60000) - (a.messageCount + a.callTime / 60000))
      .slice(0, 10),
    [serverMap]
  )

  const weeklyChart = useMemo(() => {
    const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    return dailyStats.map(d => ({
      day: weekDays[new Date(d.date).getDay()],
      minutos: Math.round(d.totalTime / 60000),
      calls: d.count,
    }))
  }, [dailyStats])

  const serverPieData = useMemo(() =>
    topServers.slice(0, 8).map(s => ({ name: s.name, value: s.messageCount })).filter(d => d.value > 0),
    [topServers]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const statCards = [
    { icon: <Users size={16} />, label: "Pessoas Únicas", value: stats?.uniqueParticipants || 0, color: "text-pink-400", bg: "bg-pink-500/10" },
    { icon: <MessageSquare size={16} />, label: "Total Mensagens", value: stats?.totalMessages || 0, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: <Clock size={16} />, label: "Tempo em Call", value: formatDuration(stats?.totalCallTime || 0), color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <Server size={16} />, label: "Servidores", value: stats?.totalServers || 0, color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <AtSign size={16} />, label: "Menções", value: totalMentions, color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: <Hash size={16} />, label: "Canais Ativos", value: channels.length, color: "text-cyan-400", bg: "bg-cyan-500/10" },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-border/40 bg-card/50 p-4 flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${s.bg}`}>
              <span className={s.color}>{s.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none truncate">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border/40 bg-card/50">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
            <BarChart3 size={14} className="text-emerald-400" />
            <h2 className="text-sm font-semibold">Atividade Semanal</h2>
          </div>
          <div className="p-4">
            {weeklyChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyChart}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => `${v}min`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#888" }} />
                  <Tooltip
                    contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number, name: string) => [
                      name === "minutos" ? `${value} min` : `${value} calls`,
                      name === "minutos" ? "Tempo" : "Calls",
                    ]}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="minutos" name="Minutos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="calls" name="Calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
            <Server size={14} className="text-violet-400" />
            <h2 className="text-sm font-semibold">Msgs por Servidor</h2>
          </div>
          <div className="p-4">
            {serverPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={serverPieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                      {serverPieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {serverPieData.slice(0, 5).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[10px] text-muted-foreground truncate flex-1">{d.name}</span>
                      <span className="text-[10px] font-mono">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-amber-400" />
              <h2 className="text-sm font-semibold">Top Interações</h2>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
              <button
                className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", topTab === "call" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTopTab("call")}
              >
                Call
              </button>
              <button
                className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", topTab === "chat" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTopTab("chat")}
              >
                Chat
              </button>
            </div>
          </div>
          <div className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto">
            {(topTab === "call" ? topByCall : topByChat).slice(0, 15).map((user, i) => {
              const maxVal = topTab === "call"
                ? (topByCall[0]?.callTime || 1)
                : (topByChat[0]?.messageCount || 1)
              const currentVal = topTab === "call" ? user.callTime : user.messageCount
              const pct = Math.max(5, Math.round((currentVal / maxVal) * 100))

              return (
                <div key={user.userId} className="rounded-lg bg-background/40 px-3 py-2.5 relative overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 opacity-[0.06]"
                    style={{
                      width: `${pct}%`,
                      background: i < 3 ? MEDAL_COLORS[i] : "#888",
                    }}
                  />
                  <div className="relative flex items-center gap-3">
                    <span
                      className="text-xs font-bold w-5 text-center"
                      style={{ color: i < 3 ? MEDAL_COLORS[i] : "#888" }}
                    >
                      {i + 1}
                    </span>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Users size={12} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.username}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        {user.callTime > 0 && (
                          <span className="flex items-center gap-1">
                            <Phone size={9} /> {formatDuration(user.callTime)}
                          </span>
                        )}
                        {user.messageCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare size={9} /> {user.messageCount}
                          </span>
                        )}
                        {user.mentionCount > 0 && (
                          <span className="flex items-center gap-1">
                            <AtSign size={9} /> {user.mentionCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => copyId(user.userId)}
                      className="p-1 rounded hover:bg-muted/50 transition-colors shrink-0"
                      title="Copiar ID"
                    >
                      {copiedId === user.userId
                        ? <CheckCheck size={12} className="text-emerald-400" />
                        : <Copy size={12} className="text-muted-foreground" />}
                    </button>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">
                      {topTab === "call" ? formatDuration(user.callTime) : `${user.messageCount} msgs`}
                    </span>
                  </div>
                </div>
              )
            })}
            {(topTab === "call" ? topByCall : topByChat).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-400" />
              <h2 className="text-sm font-semibold">Favoritos</h2>
            </div>
            <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
              <button
                className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", favTab === "canais" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setFavTab("canais")}
              >
                Canais
              </button>
              <button
                className={cn("px-2.5 py-1 text-xs rounded-md transition-colors", favTab === "servidores" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setFavTab("servidores")}
              >
                Servidores
              </button>
            </div>
          </div>
          <div className="p-3 space-y-1.5 max-h-[400px] overflow-y-auto">
            {favTab === "canais" ? (
              channels.slice(0, 15).map((ch, i) => {
                const maxMsgs = channels[0]?.messageCount || 1
                const pct = Math.max(5, Math.round((ch.messageCount / maxMsgs) * 100))
                return (
                  <div key={ch.channelId} className="rounded-lg bg-background/40 px-3 py-2.5 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-cyan-500/[0.06]" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center gap-3">
                      <span
                        className="text-xs font-bold w-5 text-center"
                        style={{ color: i < 3 ? MEDAL_COLORS[i] : "#888" }}
                      >
                        {i + 1}
                      </span>
                      <Hash size={12} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ch.channelName}</p>
                        <p className="text-[11px] text-muted-foreground">{ch.guildName}</p>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground shrink-0">
                        <p className="font-mono">{ch.messageCount} msgs</p>
                        {ch.callTime > 0 && <p className="font-mono">{formatDuration(ch.callTime)}</p>}
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              topServers.map((srv, i) => {
                const maxScore = topServers[0] ? (topServers[0].messageCount + topServers[0].callTime / 60000) : 1
                const score = srv.messageCount + srv.callTime / 60000
                const pct = Math.max(5, Math.round((score / maxScore) * 100))
                return (
                  <div key={srv.name} className="rounded-lg bg-background/40 px-3 py-2.5 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-violet-500/[0.06]" style={{ width: `${pct}%` }} />
                    <div className="relative flex items-center gap-3">
                      <span
                        className="text-xs font-bold w-5 text-center"
                        style={{ color: i < 3 ? MEDAL_COLORS[i] : "#888" }}
                      >
                        {i + 1}
                      </span>
                      <Server size={12} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{srv.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><MessageSquare size={9} /> {srv.messageCount}</span>
                          {srv.callTime > 0 && <span className="flex items-center gap-1"><Phone size={9} /> {formatDuration(srv.callTime)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            {(favTab === "canais" ? channels : topServers).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
