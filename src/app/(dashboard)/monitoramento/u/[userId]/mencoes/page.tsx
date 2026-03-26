
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  AtSign,
  Search,
  Loader2,
  Calendar,
  Hash,
  Server,
  UserIcon,
  Crown,
  Paperclip,
  Copy,
  CheckCheck,
  BarChart3,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { api } from "@/lib/api-client"
import type { MonitoredMessage } from "@/types/monitoring"
import { useWSEvent } from "@/hooks/use-websocket"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

export default function MencoesPage() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [mentions, setMentions] = useState<MonitoredMessage[]>([])
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getMentions(userId, 500)
      setMentions((res.data || []) as MonitoredMessage[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<MonitoredMessage>("monitoring:message_mention", (msg) => {
    if (msg.userId === userId) {
      setMentions(prev => [msg, ...prev].slice(0, 500))
    }
  })

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const topMentioners = useMemo(() => {
    const map = new Map<string, { username: string; userId: string; count: number }>()
    for (const m of mentions) {
      if (m.mentionedBy) {
        const entry = map.get(m.mentionedBy) || { username: m.mentionedByUsername || "desconhecido", userId: m.mentionedBy, count: 0 }
        entry.count++
        map.set(m.mentionedBy, entry)
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [mentions])

  const serverMentions = useMemo(() => {
    const map = new Map<string, { name: string; icon: string | null; count: number }>()
    for (const m of mentions) {
      const entry = map.get(m.guildId) || { name: m.guildName, icon: m.guildIcon, count: 0 }
      entry.count++
      map.set(m.guildId, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [mentions])

  const hourlyMentions = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, mencoes: 0 }))
    for (const m of mentions) {
      const h = new Date(m.timestamp).getHours()
      hours[h].mencoes++
    }
    return hours
  }, [mentions])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const filtered = search
    ? mentions.filter(m => m.content.toLowerCase().includes(search.toLowerCase()) || m.mentionedByUsername?.toLowerCase().includes(search.toLowerCase()))
    : mentions

  const today = new Date().toISOString().split("T")[0]
  const todayCount = mentions.filter(m => m.timestamp.startsWith(today)).length
  const uniqueMentioners = new Set(mentions.map(m => m.mentionedBy).filter(Boolean)).size
  const uniqueServers = new Set(mentions.map(m => m.guildId).filter(Boolean)).size
  const uniqueChannels = new Set(mentions.map(m => m.channelId)).size

  const stats = [
    { icon: <AtSign size={16} />, label: "Menções", value: mentions.length, color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: <Calendar size={16} />, label: "Hoje", value: todayCount, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <UserIcon size={16} />, label: "Pessoas", value: uniqueMentioners, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: <Server size={16} />, label: "Servidores", value: uniqueServers, color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <Hash size={16} />, label: "Canais", value: uniqueChannels, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { icon: <Crown size={16} />, label: "Top Mencionador", value: topMentioners[0]?.username || "—", color: "text-pink-400", bg: "bg-pink-500/10" },
  ]

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map((s) => (
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
        <div className="rounded-xl border border-border/40 bg-card/50 lg:col-span-2">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <BarChart3 size={14} className="text-amber-400" />
            <h3 className="text-sm font-semibold">Menções por Hora</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={hourlyMentions}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#888" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "#888" }} allowDecimals={false} width={25} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value}`, "Menções"]}
                />
                <Bar dataKey="mencoes" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <Crown size={14} className="text-pink-400" />
            <h3 className="text-sm font-semibold">Quem Mais Menciona</h3>
          </div>
          <div className="p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
            {topMentioners.slice(0, 8).map((user, i) => (
              <div key={user.userId} className="flex items-center gap-2.5 rounded-lg bg-background/40 px-3 py-2">
                <span className={`text-xs font-bold w-4 text-center ${i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-400" : i === 2 ? "text-orange-600" : "text-muted-foreground"}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.username}</p>
                  <button
                    onClick={() => copyId(user.userId)}
                    className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-0.5"
                  >
                    {copiedId === user.userId ? <CheckCheck size={8} className="text-emerald-400" /> : <Copy size={8} />}
                    <span className="font-mono">{user.userId.slice(-6)}</span>
                  </button>
                </div>
                <span className="text-xs font-mono text-amber-400">{user.count}x</span>
              </div>
            ))}
            {topMentioners.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
            )}
          </div>
        </div>
      </div>

      {serverMentions.length > 1 && (
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <Server size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold">Menções por Servidor</h3>
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {serverMentions.map((srv) => (
              <div key={srv.name} className="flex items-center gap-2 rounded-lg bg-background/40 px-3 py-2">
                {srv.icon ? (
                  <img src={srv.icon} alt="" className="w-5 h-5 rounded-full" />
                ) : (
                  <Server size={12} className="text-muted-foreground" />
                )}
                <span className="text-sm font-medium">{srv.name}</span>
                <span className="text-xs text-amber-400 font-mono">{srv.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar menções..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/50 border-border/40 h-9 text-sm"
        />
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Nenhuma menção encontrada</p>
        ) : (
          <div className="divide-y divide-border/20">
            {filtered.map((msg) => (
              <div key={msg.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-amber-400 flex items-center gap-1">
                        <AtSign size={11} />
                        {msg.mentionedByUsername || "desconhecido"}
                      </span>
                      {msg.mentionedBy && (
                        <button
                          onClick={() => copyId(msg.mentionedBy!)}
                          className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-0.5"
                          title="Copiar ID do mencionador"
                        >
                          {copiedId === msg.mentionedBy ? <CheckCheck size={8} className="text-emerald-400" /> : <Copy size={8} />}
                          <span className="font-mono">{msg.mentionedBy.slice(-6)}</span>
                        </button>
                      )}
                      <span className="text-[10px] text-muted-foreground">mencionou</span>
                    </div>
                    <p className="text-sm leading-relaxed">{msg.content || <span className="text-muted-foreground italic">[sem texto]</span>}</p>
                    {msg.attachments.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Paperclip size={11} className="text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">{msg.attachments.length} anexo(s)</span>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-[11px] text-muted-foreground font-mono">{formatTime(msg.timestamp)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(msg.timestamp)}</p>
                    <button
                      onClick={() => copyId(msg.messageId)}
                      className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground flex items-center gap-0.5 ml-auto"
                      title="Copiar ID da mensagem"
                    >
                      {copiedId === msg.messageId ? <CheckCheck size={8} className="text-emerald-400" /> : <Copy size={8} />}
                      <span className="font-mono">{msg.messageId.slice(-6)}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Hash size={10} /> {msg.channelName}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {msg.guildIcon ? <img src={msg.guildIcon} alt="" className="w-3.5 h-3.5 rounded-full" /> : <Server size={10} />} {msg.guildName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
