
import { useState, useEffect, useCallback, useMemo } from "react"
import { useParams } from "react-router-dom"
import {
  ImageIcon,
  Video,
  FileIcon,
  Headphones,
  Search,
  Loader2,
  Grid3X3,
  List,
  Download,
  ExternalLink,
  Hash,
  Server,
  HardDrive,
  Calendar,
  Copy,
  CheckCheck,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts"
import { api } from "@/lib/api-client"
import type { MediaItem } from "@/types/monitoring"
import { cn } from "@/lib/utils"
import { useWSEvent } from "@/hooks/use-websocket"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR")
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  image: <ImageIcon size={16} className="text-cyan-400" />,
  video: <Video size={16} className="text-violet-400" />,
  audio: <Headphones size={16} className="text-amber-400" />,
  document: <FileIcon size={16} className="text-zinc-400" />,
}

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#6b7280"]

export default function MidiaPage() {
  const { userId } = useParams<{ userId: string }>()
  const [loading, setLoading] = useState(true)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getUserMediaList(userId, undefined, 500)
      setMedia((res.data || []) as MediaItem[])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<MediaItem>("monitoring:media", (item) => {
    if (item.userId === userId) {
      setMedia(prev => [item, ...prev].slice(0, 500))
    }
  })

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const filtered = useMemo(() =>
    media
      .filter(m => !typeFilter || m.type === typeFilter)
      .filter(m => !search || m.attachment.filename.toLowerCase().includes(search.toLowerCase()) || m.channelName.toLowerCase().includes(search.toLowerCase())),
    [media, typeFilter, search]
  )

  const images = useMemo(() => media.filter(m => m.type === "image"), [media])
  const videos = useMemo(() => media.filter(m => m.type === "video"), [media])
  const audios = useMemo(() => media.filter(m => m.type === "audio"), [media])
  const docs = useMemo(() => media.filter(m => m.type === "document"), [media])

  const totalSize = useMemo(() => media.reduce((acc, m) => acc + m.attachment.size, 0), [media])

  const today = new Date().toISOString().split("T")[0]
  const todayCount = useMemo(() => media.filter(m => m.timestamp.startsWith(today)).length, [media, today])

  const pieData = useMemo(() => [
    { name: "Imagens", value: images.length },
    { name: "VÃ­deos", value: videos.length },
    { name: "Ãudios", value: audios.length },
    { name: "Docs", value: docs.length },
  ].filter(d => d.value > 0), [images, videos, audios, docs])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const stats = [
    { icon: <ImageIcon size={16} />, label: "Total", value: media.length, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { icon: <ImageIcon size={16} />, label: "Imagens", value: images.length, color: "text-blue-400", bg: "bg-blue-500/10" },
    { icon: <Video size={16} />, label: "VÃ­deos", value: videos.length, color: "text-violet-400", bg: "bg-violet-500/10" },
    { icon: <Headphones size={16} />, label: "Ãudios", value: audios.length, color: "text-amber-400", bg: "bg-amber-500/10" },
    { icon: <HardDrive size={16} />, label: "Tamanho Total", value: formatSize(totalSize), color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { icon: <Calendar size={16} />, label: "Hoje", value: todayCount, color: "text-pink-400", bg: "bg-pink-500/10" },
  ]

  function getMediaUrl(item: MediaItem): string {
    if (item.attachment.localPath) {
      return api.getMediaFileUrl(userId, item.attachment.localPath)
    }
    return item.attachment.proxyUrl || item.attachment.url
  }

  const filters = [
    { label: "Todos", value: null },
    { label: "Imagens", value: "image" },
    { label: "VÃ­deos", value: "video" },
    { label: "Ãudios", value: "audio" },
    { label: "Docs", value: "document" },
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

      {pieData.length > 1 && (
        <div className="rounded-xl border border-border/40 bg-card/50 p-4">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={44} innerRadius={22}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-4">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-muted-foreground">{d.name}</span>
                  <span className="text-xs font-mono font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar mÃ­dia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/50 border-border/40 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
          {filters.map(f => (
            <button
              key={f.label}
              className={cn(
                "px-2.5 py-1 text-xs rounded-md transition-colors",
                typeFilter === f.value ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5">
          <button
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground")}
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 size={13} />
          </button>
          <button
            className={cn("p-1.5 rounded-md transition-colors", viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground")}
            onClick={() => setViewMode("list")}
          >
            <List size={13} />
          </button>
        </div>
        <span className="text-[11px] text-muted-foreground ml-auto">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/40 bg-card/50 p-12 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma mÃ­dia encontrada</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="group relative rounded-xl border border-border/40 bg-card/50 overflow-hidden">
              {item.type === "image" ? (
                <div className="aspect-square bg-background/40">
                  <img
                    src={getMediaUrl(item)}
                    alt={item.attachment.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ) : item.type === "video" ? (
                <div className="aspect-square bg-background/40 relative flex items-center justify-center">
                  <Video size={28} className="text-violet-400" />
                  <div className="absolute bottom-1 right-1 bg-black/60 rounded px-1 py-0.5">
                    <span className="text-[9px] text-white font-mono">{formatSize(item.attachment.size)}</span>
                  </div>
                </div>
              ) : item.type === "audio" ? (
                <div className="aspect-square bg-background/40 flex flex-col items-center justify-center gap-2">
                  <Headphones size={24} className="text-amber-400" />
                  <span className="text-[10px] text-muted-foreground">{formatSize(item.attachment.size)}</span>
                </div>
              ) : (
                <div className="aspect-square bg-background/40 flex flex-col items-center justify-center gap-2">
                  <FileIcon size={24} className="text-zinc-400" />
                  <span className="text-[10px] text-muted-foreground">{formatSize(item.attachment.size)}</span>
                </div>
              )}
              <div className="p-2.5">
                <p className="text-[11px] font-medium truncate">{item.attachment.filename}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{formatSize(item.attachment.size)}</span>
                  <span className="text-[10px] text-muted-foreground">Â·</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(item.timestamp)}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Hash size={8} className="text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground truncate">{item.channelName}</span>
                  {item.guildIcon && <img src={item.guildIcon} alt="" className="w-3 h-3 rounded-full ml-auto" />}
                </div>
              </div>
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a
                  href={getMediaUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors"
                >
                  <ExternalLink size={14} className="text-white" />
                </a>
                <a
                  href={getMediaUrl(item)}
                  download={item.attachment.filename}
                  className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors"
                >
                  <Download size={14} className="text-white" />
                </a>
                <button
                  onClick={() => copyId(item.messageId)}
                  className="rounded-full bg-white/10 p-2 hover:bg-white/20 transition-colors"
                  title="Copiar ID da mensagem"
                >
                  {copiedId === item.messageId ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/50 divide-y divide-border/20">
          {filtered.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
              {item.type === "image" ? (
                <img src={getMediaUrl(item)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" loading="lazy" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-background/40 flex items-center justify-center shrink-0">
                  {TYPE_ICON[item.type]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.attachment.filename}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Hash size={9} />
                  <span>{item.channelName}</span>
                  <span>Â·</span>
                  {item.guildIcon ? <img src={item.guildIcon} alt="" className="w-3.5 h-3.5 rounded-full" /> : <Server size={9} />}
                  <span className="truncate">{item.guildName}</span>
                  <span>Â·</span>
                  <span>{formatSize(item.attachment.size)}</span>
                </div>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-[11px] text-muted-foreground font-mono">{formatTime(item.timestamp)}</p>
                <p className="text-[10px] text-muted-foreground">{formatDate(item.timestamp)}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => copyId(item.messageId)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                  title="Copiar ID"
                >
                  {copiedId === item.messageId ? <CheckCheck size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
                <a
                  href={getMediaUrl(item)}
                  download={item.attachment.filename}
                  className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download size={13} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
