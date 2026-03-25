
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  MessageSquare,
  Search,
  Loader2,
  Paperclip,
  Hash,
  Server,
  Calendar,
  Mic,
  Reply,
  Sticker,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Download,
  Copy,
  CheckCheck,
  BarChart3,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { api } from "@/lib/api-client"
import type { MonitoredMessage, MonitoredAttachment } from "@/types/monitoring"
import { useWSEvent } from "@/hooks/use-websocket"
import { cn } from "@/lib/utils"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
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

export default function MensagensPage() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<MonitoredMessage[]>([])
  const [search, setSearch] = useState("")
  const [channelFilter, setChannelFilter] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getUserMessages(userId, undefined, 500)
      setMessages((res.data || []) as MonitoredMessage[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<MonitoredMessage>("monitoring:message", (msg) => {
    if (msg.userId === userId && msg.eventType === "create" && !msg.isMention) {
      setMessages(prev => [msg, ...prev].slice(0, 500))
    }
  })

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const sentMessages = useMemo(() =>
    messages.filter(m => !m.isMention && !m.deleted && m.eventType === "create"),
    [messages]
  )

  const channelStats = useMemo(() => {
    const map = new Map<string, { name: string; count: number; guildName: string; guildIcon: string | null }>()
    for (const m of sentMessages) {
      const entry = map.get(m.channelId) || { name: m.channelName, count: 0, guildName: m.guildName, guildIcon: m.guildIcon }
      entry.count++
      map.set(m.channelId, entry)
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ channelId: id, ...v }))
      .sort((a, b) => b.count - a.count)
  }, [sentMessages])

  const topChannelsChart = useMemo(() =>
    channelStats.slice(0, 8).map(c => ({ name: `#${c.name.slice(0, 12)}`, msgs: c.count })),
    [channelStats]
  )

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const filtered = messages
    .filter(m => !channelFilter || m.channelId === channelFilter)
    .filter(m => !search || m.content.toLowerCase().includes(search.toLowerCase()) || m.channelName.toLowerCase().includes(search.toLowerCase()))

  const today = new Date().toISOString().split("T")[0]
  const todayMsgs = sentMessages.filter(m => m.timestamp.startsWith(today))
  const withAttachments = sentMessages.filter(m => m.attachments.length > 0)
  const uniqueChannels = new Set(sentMessages.map(m => m.channelId)).size
  const voiceMessages = sentMessages.filter(m => m.isVoiceMessage)
  const withStickers = sentMessages.filter(m => m.sticker)
  const withEmbeds = sentMessages.filter(m => m.embeds > 0)

  const stats = [
    { icon: <MessageSquare size={16} />, label: "Mensagens", value: sentMessages.length, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: <Calendar size={16} />, label: "Hoje", value: todayMsgs.length, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <Paperclip size={16} />, label: "Com Anexos", value: withAttachments.length, color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <Hash size={16} />, label: "Canais", value: uniqueChannels, color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: <Mic size={16} />, label: "Voz", value: voiceMessages.length, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { icon: <Sticker size={16} />, label: "Stickers", value: withStickers.length, color: "text-pink-400", bg: "bg-pink-500/10" },
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

      {topChannelsChart.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20">
            <BarChart3 size={14} className="text-blue-400" />
            <h3 className="text-sm font-semibold">Canais Mais Ativos</h3>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={topChannelsChart} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "#888" }} width={100} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value}`, "Msgs"]}
                />
                <Bar dataKey="msgs" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar mensagens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/50 border-border/40 h-9 text-sm"
          />
        </div>
        {channelStats.length > 1 && (
          <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5 overflow-x-auto max-w-lg">
            <button
              className={cn("px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                !channelFilter ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setChannelFilter(null)}
            >
              Todos
            </button>
            {channelStats.slice(0, 5).map(ch => (
              <button
                key={ch.channelId}
                className={cn("px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap",
                  channelFilter === ch.channelId ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setChannelFilter(ch.channelId)}
              >
                #{ch.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/40 bg-card/50">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center">Nenhuma mensagem encontrada</p>
        ) : (
          <div className="divide-y divide-border/20">
            {filtered.map((msg) => (
              <div key={msg.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {msg.replyTo && (
                      <div className="flex items-center gap-1 mb-1">
                        <Reply size={10} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">respondeu a uma mensagem</span>
                      </div>
                    )}
                    {msg.isVoiceMessage && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Mic size={12} className="text-cyan-400" />
                        <span className="text-[11px] text-cyan-400 font-medium">
                          Mensagem de voz{msg.voiceDuration ? ` Â· ${msg.voiceDuration}s` : ""}
                        </span>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content || <span className="text-muted-foreground italic">[sem texto]</span>}</p>
                    {msg.sticker && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Sticker size={11} className="text-pink-400" />
                        <span className="text-[11px] text-pink-400">{msg.sticker.name}</span>
                      </div>
                    )}
                    {msg.attachments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => {
                          const type = getAttachmentType(att)
                          const url = att.localPath
                            ? api.getMediaFileUrl(userId, att.localPath)
                            : att.proxyUrl || att.url

                          if (type === "image") {
                            return (
                              <a key={att.id} href={url} target="_blank" rel="noopener noreferrer" className="block">
                                <img src={url} alt={att.filename} className="max-h-32 max-w-[200px] object-contain rounded-lg border border-border/30" loading="lazy" />
                              </a>
                            )
                          }
                          if (type === "video") {
                            return (
                              <video key={att.id} src={url} controls className="max-h-32 max-w-[200px] rounded-lg border border-border/30" preload="metadata" />
                            )
                          }
                          if (type === "audio") {
                            return (
                              <div key={att.id} className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-2 py-1.5">
                                <Music size={12} className="text-violet-400 shrink-0" />
                                <audio src={url} controls className="h-6" preload="metadata" />
                              </div>
                            )
                          }
                          return (
                            <a key={att.id} href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-2 py-1.5 hover:bg-muted/40 transition-colors">
                              <FileText size={12} className="text-blue-400 shrink-0" />
                              <span className="text-[11px] truncate max-w-[150px]">{att.filename}</span>
                              <span className="text-[10px] text-muted-foreground">{formatFileSize(att.size)}</span>
                            </a>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-[11px] text-muted-foreground font-mono">{formatTime(msg.timestamp)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(msg.timestamp)}</p>
                    <button
                      onClick={() => copyId(msg.messageId)}
                      className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors flex items-center gap-0.5 ml-auto"
                      title="Copiar ID da mensagem"
                    >
                      {copiedId === msg.messageId ? <CheckCheck size={9} className="text-emerald-400" /> : <Copy size={9} />}
                      <span className="font-mono">{msg.messageId.slice(-6)}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Hash size={10} /> {msg.channelName}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    {msg.guildIcon ? <img src={msg.guildIcon} alt="" className="w-3.5 h-3.5 rounded-full" /> : <Server size={10} />} {msg.guildName}
                  </span>
                  {msg.editedAt && (
                    <span className="text-[11px] text-amber-400/80">(editada)</span>
                  )}
                  {msg.embeds > 0 && (
                    <span className="text-[11px] text-blue-400/60">{msg.embeds} embed{msg.embeds > 1 ? "s" : ""}</span>
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
