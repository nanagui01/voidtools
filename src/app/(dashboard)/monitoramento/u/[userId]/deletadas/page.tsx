
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  Trash2,
  Search,
  Loader2,
  Clock,
  Calendar,
  AlertTriangle,
  Hash,
  Server,
  Paperclip,
  FileText,
  Download,
  Image as ImageIcon,
  Film,
  Music,
  Zap,
  Copy,
  CheckCheck,
  BarChart3,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import { api } from "@/lib/api-client"
import type { MonitoredMessage, MonitoredAttachment } from "@/types/monitoring"
import { useWSEvent } from "@/hooks/use-websocket"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function timeBetween(sent: string, deleted: string): string {
  const ms = new Date(deleted).getTime() - new Date(sent).getTime()
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function formatAvgTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function getAttachmentType(att: MonitoredAttachment): "image" | "video" | "audio" | "file" {
  const ct = att.contentType?.toLowerCase() || ""
  if (ct.startsWith("image/")) return "image"
  if (ct.startsWith("video/")) return "video"
  if (ct.startsWith("audio/") || att.filename?.endsWith(".ogg")) return "audio"
  return "file"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#ec4899", "#f97316"]

export default function DeletadasPage() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<MonitoredMessage[]>([])
  const [search, setSearch] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getDeletedMessages(userId, 500)
      setMessages((res.data || []) as MonitoredMessage[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<MonitoredMessage>("monitoring:message_delete", (msg) => {
    if (msg.userId === userId) {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id && m.deletedAt === msg.deletedAt)) return prev
        return [msg, ...prev].slice(0, 500)
      })
    }
  })

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const withTimeDiffs = useMemo(() =>
    messages.filter(m => m.deletedAt).map(m => ({
      msg: m,
      diff: new Date(m.deletedAt!).getTime() - new Date(m.timestamp).getTime()
    })),
    [messages]
  )

  const avgDeleteTime = useMemo(() =>
    withTimeDiffs.length > 0 ? withTimeDiffs.reduce((a, b) => a + b.diff, 0) / withTimeDiffs.length : 0,
    [withTimeDiffs]
  )

  const fastestDelete = useMemo(() => {
    if (withTimeDiffs.length === 0) return null
    return withTimeDiffs.reduce((min, curr) => curr.diff < min.diff ? curr : min)
  }, [withTimeDiffs])

  const channelBreakdown = useMemo(() => {
    const map = new Map<string, { name: string; count: number; guildName: string }>()
    for (const m of messages) {
      const entry = map.get(m.channelId) || { name: m.channelName, count: 0, guildName: m.guildName }
      entry.count++
      map.set(m.channelId, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [messages])

  const hourlyPattern = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}h`, deletadas: 0 }))
    for (const m of messages) {
      if (m.deletedAt) {
        const h = new Date(m.deletedAt).getHours()
        hours[h].deletadas++
      }
    }
    return hours
  }, [messages])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const filtered = search
    ? messages.filter(m => m.content.toLowerCase().includes(search.toLowerCase()))
    : messages

  const today = new Date().toISOString().split("T")[0]
  const todayCount = messages.filter(m => m.deletedAt?.startsWith(today)).length
  const thisWeek = new Date()
  thisWeek.setDate(thisWeek.getDate() - 7)
  const weekCount = messages.filter(m => m.deletedAt && new Date(m.deletedAt) >= thisWeek).length
  const withAttachments = messages.filter(m => m.attachments.length > 0).length

  const stats = [
    { icon: <Trash2 size={16} />, label: "Deletadas", value: messages.length, color: "text-red-400", bg: "bg-red-500/10" },
    { icon: <Calendar size={16} />, label: "Hoje", value: todayCount, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <AlertTriangle size={16} />, label: "Semana", value: weekCount, color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: <Clock size={16} />, label: "Tempo MÃ©dio", value: formatAvgTime(avgDeleteTime), color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <Zap size={16} />, label: "Mais RÃ¡pida", value: fastestDelete ? formatAvgTime(fastestDelete.diff) : "â€”", color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { icon: <Paperclip size={16} />, label: "Com Anexos", value: withAttachments, color: "text-pink-400", bg: "bg-pink-500/10" },
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
              <p className="text-xl font-bold leading-none">{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <BarChart3 size={14} className="text-red-400" />
            <h3 className="text-sm font-semibold">PadrÃ£o de DeleÃ§Ã£o (por hora)</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={hourlyPattern}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#888" }} interval={2} />
                <YAxis tick={{ fontSize: 9, fill: "#888" }} allowDecimals={false} width={25} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value}`, "Deletadas"]}
                />
                <Bar dataKey="deletadas" fill="#ef4444" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {channelBreakdown.length > 0 && (
          <div className="rounded-xl border border-border/40 bg-card/50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
              <Hash size={14} className="text-amber-400" />
              <h3 className="text-sm font-semibold">Por Canal</h3>
            </div>
            <div className="p-4 flex items-center gap-4">
              <div className="w-28 h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelBreakdown.map((c, i) => ({ name: c.name, value: c.count }))}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      outerRadius={50}
                      innerRadius={25}
                    >
                      {channelBreakdown.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5 max-h-[120px] overflow-y-auto">
                {channelBreakdown.map((ch, i) => (
                  <div key={ch.name} className="flex items-center gap-2 text-[11px]">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground flex items-center gap-1 truncate">
                      <Hash size={9} /> {ch.name}
                    </span>
                    <span className="ml-auto font-mono font-medium">{ch.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar em deletadas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/50 border-border/40 h-9 text-sm"
        />
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Nenhuma mensagem deletada encontrada</p>
        ) : (
          <div className="divide-y divide-border/20">
            {filtered.map((msg, i) => (
              <div key={`${msg.id}_${msg.deletedAt || i}`} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-300/80 line-through leading-relaxed">
                      {msg.content || <span className="italic text-muted-foreground no-underline">[sem texto]</span>}
                    </p>
                    {msg.originalContent && msg.originalContent !== msg.content && (
                      <p className="text-[11px] text-muted-foreground/60 mt-1 italic">
                        Original: {msg.originalContent}
                      </p>
                    )}
                    {msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Paperclip size={11} className="text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">{msg.attachments.length} anexo(s) salvo(s)</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.attachments.map((att) => {
                            const type = getAttachmentType(att)
                            const url = att.localPath
                              ? api.getMediaFileUrl(userId, att.localPath)
                              : att.proxyUrl || att.url

                            if (type === "image") {
                              return (
                                <a key={att.id} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                  <div className="relative group rounded-lg overflow-hidden border border-border/30 bg-black/20">
                                    <img src={url} alt={att.filename} className="max-h-48 max-w-xs object-contain rounded-lg" loading="lazy" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <ImageIcon size={20} className="text-white" />
                                    </div>
                                  </div>
                                </a>
                              )
                            }
                            if (type === "video") {
                              return (
                                <div key={att.id} className="rounded-lg overflow-hidden border border-border/30 bg-black/20">
                                  <video src={url} controls className="max-h-48 max-w-xs rounded-lg" preload="metadata" />
                                </div>
                              )
                            }
                            if (type === "audio") {
                              return (
                                <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2">
                                  <Music size={14} className="text-violet-400 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-xs truncate max-w-[200px]">{att.filename}</p>
                                    <audio src={url} controls className="h-7 mt-1" preload="metadata" />
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <a key={att.id} href={url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
                                <FileText size={14} className="text-blue-400 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs truncate max-w-[200px]">{att.filename}</p>
                                  <p className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</p>
                                </div>
                                <Download size={12} className="text-muted-foreground shrink-0" />
                              </a>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Enviada: {formatTime(msg.timestamp)}</p>
                    {msg.deletedAt && (
                      <>
                        <p className="text-[11px] text-red-400">Deletada: {formatTime(msg.deletedAt)}</p>
                        <p className="text-[10px] text-amber-400/70">
                          <Clock size={9} className="inline mr-0.5" />
                          {timeBetween(msg.timestamp, msg.deletedAt)}
                        </p>
                      </>
                    )}
                    <button
                      onClick={() => copyId(msg.messageId)}
                      className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-0.5 ml-auto"
                      title="Copiar ID"
                    >
                      {copiedId === msg.messageId ? <CheckCheck size={9} className="text-emerald-400" /> : <Copy size={9} />}
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
                  {msg.editedAt && (
                    <span className="text-[11px] text-amber-400/80">(editada antes de deletar)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
