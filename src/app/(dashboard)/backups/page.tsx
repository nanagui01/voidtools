
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { createPortal } from "react-dom"
import Lottie from "lottie-react"
import {
  Archive,
  Trash2,
  Loader2,
  MessageSquare,
  Paperclip,
  Clock,
  HardDrive,
  Cloud,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  Download,
  FileText,
  Phone,
  PhoneMissed,
  Copy,
  ExternalLink,
  Eye,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  Image,
  Video,
  Music2,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { api } from "@/lib/api-client"
import type { Badge } from "@/types/discord"

const API_BASE = "http://127.0.0.1:3777/api"

interface BackupMeta {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  badges: Badge[]
  totalMessages: number
  totalAttachments: number
  savedMediaLocally: boolean
  createdAt: string
  folderName: string
  folderPath: string
  jsonFile: string
  durationSeconds: number
}

interface BackupMessage {
  id: string
  type: string
  author: {
    id: string
    username: string
    globalName: string | null
    avatarUrl: string
    bot: boolean
  }
  content: string
  createdTimestamp: number
  attachments: BackupAttachment[]
  embeds: BackupEmbed[]
  stickers: BackupSticker[]
  call?: {
    participants: string[]
    duration: number | null
  }
}

interface BackupAttachment {
  id: string
  name: string
  url: string
  localPath?: string
  contentType: string | null
  size: number
}

interface BackupSticker {
  id: string
  name: string
  url: string
  format: "png" | "apng" | "lottie" | "gif"
}

interface BackupEmbed {
  type: string | null
  title: string | null
  description: string | null
  url: string | null
  color: number | null
  timestamp: string | null
  author: { name: string; url: string | null; iconUrl: string | null } | null
  footer: { text: string; iconUrl: string | null } | null
  thumbnail: { url: string; width: number | null; height: number | null } | null
  image: { url: string; width: number | null; height: number | null } | null
  video: { url: string; width: number | null; height: number | null } | null
  provider: { name: string | null; url: string | null } | null
  fields: { name: string; value: string; inline: boolean }[]
}

interface BackupData {
  version: number
  meta: {
    userId: string
    username: string
    avatarUrl: string | null
    createdAt: string
    totalMessages: number
    totalAttachments: number
    savedMediaLocally: boolean
  }
  messages: BackupMessage[]
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0) + " " + sizes[i]
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatFullDate(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${formatTimestamp(ts)}`
}

const FALLBACK_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' rx='20' fill='%23383a40'/%3E%3Ctext x='50%25' y='54%25' text-anchor='middle' dominant-baseline='middle' fill='%23808080' font-size='16'%3E%3F%3C/text%3E%3C/svg%3E"
const FALLBACK_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Crect width='160' height='160' rx='8' fill='%231e1f22'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle' fill='%23606060' font-size='13'%3EImagem indispon\u00edvel%3C/text%3E%3C/svg%3E"

function imgFallback(fallback: string) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    img.onerror = null
    img.src = fallback
  }
}

function resolveAssetUrl(backupId: string, att: BackupAttachment): string {
  if (att.localPath) {
    const filename = att.localPath.replace(/^assets[\\/]/, '')
    return `${API_BASE}/backups/${backupId}/assets/${encodeURIComponent(filename)}`
  }
  return att.url
}

function processContent(text: string, inline = false): string {
  if (!text) return ""

  const placeholders: string[] = []
  const ph = (html: string) => {
    const idx = placeholders.length
    placeholders.push(html)
    return `\x00PH${idx}\x00`
  }

  let p = text

  p = p.replace(/```([\s\S]+?)```/g, (_, code) => {
    const escaped = code.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return ph(`<div class="my-1.5 rounded-md bg-[#1e1f22] border border-[#2a2b30] overflow-x-auto"><div class="px-3 py-2 text-[13px] font-mono whitespace-pre-wrap leading-relaxed text-[#d4d4d4]">${escaped}</div></div>`)
  })

  p = p.replace(/`([^`]+)`/g, (_, code) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    return ph(`<code class="rounded bg-[#383a40] px-1.5 py-0.5 text-[13px] font-mono">${escaped}</code>`)
  })

  p = p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  p = p.replace(/&lt;(a?):([^:]+):(\d+)&gt;/g, (_, animated, name, id) => {
    const ext = animated === "a" ? "gif" : "png"
    return ph(`<img src="https://cdn.discordapp.com/emojis/${id}.${ext}?size=48&quality=lossless" alt=":${name}:" title=":${name}:" class="inline-block h-[1.375em] w-auto align-[-0.3em] object-contain" loading="lazy" onerror="this.alt=':${name}:';this.style.display='none'">`)
  })

  p = p.replace(/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g, (_, ts, fmt) => {
    const date = new Date(parseInt(ts) * 1000)
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
    const diasSemana = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"]
    const dia = date.getDate()
    const mes = meses[date.getMonth()]
    const ano = date.getFullYear()
    const hora = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    let formatted = ""
    switch (fmt) {
      case "t": formatted = hora; break
      case "T": formatted = `${hora}:${String(date.getSeconds()).padStart(2, "0")}`; break
      case "d": formatted = `${String(dia).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${ano}`; break
      case "D": formatted = `${dia} de ${mes} de ${ano}`; break
      case "f": formatted = `${dia} de ${mes} de ${ano} ${hora}`; break
      case "F": formatted = `${diasSemana[date.getDay()]}, ${dia} de ${mes} de ${ano} ${hora}`; break
      case "R": formatted = `${dia} de ${mes} de ${ano} ${hora}`; break
      default: formatted = `${dia} de ${mes} de ${ano} ${hora}`
    }
    return ph(`<span class="rounded bg-[#383a40] px-1 py-0.5 text-[13px] cursor-default" title="${date.toISOString()}">${formatted}</span>`)
  })

  p = p.replace(/&lt;@!?(\d+)&gt;/g, (_, _id) =>
    ph(`<span class="rounded bg-[#5865f2]/20 px-1 text-[#c9cdfb] font-medium cursor-default hover:bg-[#5865f2]/30">@user</span>`))

  p = p.replace(/&lt;#(\d+)&gt;/g, (_, _id) =>
    ph(`<span class="rounded bg-[#5865f2]/20 px-1 text-[#c9cdfb] font-medium cursor-default">#channel</span>`))

  p = p.replace(/&lt;@&amp;(\d+)&gt;/g, (_, _id) =>
    ph(`<span class="rounded bg-[#5865f2]/20 px-1 text-[#c9cdfb] font-medium cursor-default">@role</span>`))

  p = p.replace(/^-#\s+(.+)$/gm, '<span class="text-xs text-muted-foreground">$1</span>')

  p = p.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")

  p = p.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")

  p = p.replace(/__(.+?)__/g, "<u>$1</u>")

  p = p.replace(/~~(.+?)~~/g, '<s class="opacity-60">$1</s>')

  p = p.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, text, url) =>
    ph(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[#00a8fc] hover:underline font-semibold">${text}</a>`))

  p = p.replace(/(https?:\/\/[^\s\x00<]+)/g, (_, url) =>
    ph(`<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[#00a8fc] hover:underline break-all">${url}</a>`))

  p = inline ? p.replace(/\n/g, " ") : p.replace(/\n/g, "<br>")

  p = p.replace(/\x00PH(\d+)\x00/g, (_, idx) => placeholders[parseInt(idx)])

  return p
}

function isNewGroup(msg: BackupMessage, prev: BackupMessage | null): boolean {
  if (!prev) return true
  if (msg.author.id !== prev.author.id) return true
  if (msg.createdTimestamp - prev.createdTimestamp > 7 * 60 * 1000) return true
  return false
}

function isDifferentDay(ts1: number, ts2: number): boolean {
  const d1 = new Date(ts1)
  const d2 = new Date(ts2)
  return d1.getDate() !== d2.getDate() || d1.getMonth() !== d2.getMonth() || d1.getFullYear() !== d2.getFullYear()
}

function BadgeRow({ badges }: { badges: Badge[] }) {
  if (!badges || badges.length === 0) return null
  return (
    <div className="flex items-center gap-0.5">
      {badges.map((badge) => (
        <Tooltip key={badge.name}>
          <TooltipTrigger asChild>
            <img src={badge.url} alt={badge.tooltip} className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{badge.tooltip}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

function DateSeparator({ timestamp }: { timestamp: number }) {
  const d = new Date(timestamp)
  const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"]
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]
  return (
    <div className="flex items-center gap-3 my-5 px-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
        {dias[d.getDay()]}, {d.getDate()} de {meses[d.getMonth()]} de {d.getFullYear()}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}

interface LightboxImage {
  att: BackupAttachment
  url: string
}

function ImageLightbox({ images, initialIndex, onClose, onContextMenu }: {
  images: LightboxImage[]
  initialIndex: number
  onClose: () => void
  onContextMenu: (e: React.MouseEvent, att: BackupAttachment, url: string) => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const thumbsRef = useRef<HTMLDivElement>(null)
  const activeThumbRef = useRef<HTMLButtonElement>(null)

  const current = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const goTo = useCallback((i: number) => {
    setIndex(i)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const prev = useCallback(() => { if (hasPrev) goTo(index - 1) }, [hasPrev, index, goTo])
  const next = useCallback(() => { if (hasNext) goTo(index + 1) }, [hasNext, index, goTo])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape": onClose(); break
        case "ArrowLeft": prev(); break
        case "ArrowRight": next(); break
        case "+":
        case "=": setZoom((z) => Math.min(z + 0.5, 5)); break
        case "-": setZoom((z) => Math.max(z - 0.5, 0.5)); break
        case "0": resetView(); break
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [onClose, prev, next, resetView])

  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
  }, [index])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(5, Math.max(0.5, z + (e.deltaY > 0 ? -0.15 : 0.15))))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [zoom, pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    })
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  const handleDownload = useCallback(() => {
    const a = document.createElement("a")
    a.href = current.url
    a.download = current.att.name
    a.click()
  }, [current])

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col bg-black/95 backdrop-blur-sm animate-in fade-in duration-150" style={{ width: '100vw', height: '100vh', left: 0, top: 0 }}>
      <div className="shrink-0 flex items-center justify-between px-4 h-12">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-white/70 truncate max-w-[300px]">{current.att.name}</span>
          <span className="text-xs text-white/40">{index + 1} / {images.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setZoom((z) => Math.min(z + 0.5, 5))} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <ZoomIn size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zoom +</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setZoom((z) => Math.max(z - 0.5, 0.5))} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <ZoomOut size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Zoom -</TooltipContent>
          </Tooltip>
          {zoom !== 1 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={resetView} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                  <RotateCcw size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Resetar zoom</TooltipContent>
            </Tooltip>
          )}
          <div className="w-px h-5 bg-white/10 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (current.att.url?.startsWith("http")) window.electronAPI?.shell.openExternal(current.att.url)
                }}
                className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <ExternalLink size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Abrir no navegador</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleDownload} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <Download size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Baixar</TooltipContent>
          </Tooltip>
          <div className="w-px h-5 bg-white/10 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={onClose} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
                <X size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Fechar (Esc)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden select-none">
        {hasPrev && (
          <button
            onClick={prev}
            className="absolute left-4 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        <div
          className="flex items-center justify-center w-full h-full"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={(e) => {
            if (e.target === e.currentTarget && zoom <= 1) onClose()
          }}
          style={{ cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default" }}
        >
          <img
            src={current.url}
            alt={current.att.name}
            className="max-w-[85vw] max-h-[calc(100vh-140px)] object-contain transition-transform duration-100"
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            }}
            draggable={false}
            onContextMenu={(e) => onContextMenu(e, current.att, current.url)}
            onError={imgFallback(FALLBACK_IMAGE)}
          />
        </div>

        {hasNext && (
          <button
            onClick={next}
            className="absolute right-4 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {images.length > 1 && (
        <div className="shrink-0 flex justify-center py-3 px-4">
          <div
            ref={thumbsRef}
            className="flex gap-1.5 overflow-x-auto max-w-[80vw] pb-1 scrollbar-none"
            style={{ scrollbarWidth: "none" }}
          >
            {images.map((img, i) => (
              <button
                key={img.att.id}
                ref={i === index ? activeThumbRef : undefined}
                onClick={() => goTo(i)}
                className={`shrink-0 rounded-md overflow-hidden border-2 transition-all ${
                  i === index
                    ? "border-white/80 opacity-100 scale-105"
                    : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                <img
                  src={img.url}
                  alt={img.att.name}
                  className="w-14 h-14 object-cover"
                  loading="lazy"
                  onError={imgFallback(FALLBACK_IMAGE)}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

interface ContextMenuState {
  x: number
  y: number
  att: BackupAttachment
  url: string
  localFullPath: string | null
}

function AttachmentContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const escHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", handler)
    document.addEventListener("keydown", escHandler)
    return () => {
      document.removeEventListener("mousedown", handler)
      document.removeEventListener("keydown", escHandler)
    }
  }, [onClose])

  const [pos, setPos] = useState({ x: menu.x, y: menu.y })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let { x, y } = menu
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8
    setPos({ x, y })
  }, [menu])

  const items: { icon: React.ReactNode; label: string; action: () => void; show: boolean }[] = [
    {
      icon: <Eye size={14} />,
      label: "Abrir arquivo",
      action: () => {
        if (menu.localFullPath) window.electronAPI?.shell.openPath(menu.localFullPath)
        else window.electronAPI?.shell.openExternal(menu.att.url)
      },
      show: true,
    },
    {
      icon: <FolderOpen size={14} />,
      label: "Mostrar no Explorer",
      action: () => {
        if (menu.localFullPath) window.electronAPI?.shell.showItemInFolder(menu.localFullPath)
      },
      show: !!menu.localFullPath,
    },
    {
      icon: <ExternalLink size={14} />,
      label: "Abrir link original",
      action: () => window.electronAPI?.shell.openExternal(menu.att.url),
      show: !!menu.att.url && menu.att.url.startsWith("http"),
    },
    {
      icon: <Copy size={14} />,
      label: "Copiar link",
      action: () => window.electronAPI?.clipboard.writeText(menu.att.url),
      show: !!menu.att.url && menu.att.url.startsWith("http"),
    },
    {
      icon: <Download size={14} />,
      label: "Baixar",
      action: () => {
        const a = document.createElement("a")
        a.href = menu.url
        a.download = menu.att.name
        a.click()
      },
      show: true,
    },
  ]

  const visibleItems = items.filter((i) => i.show)

  return (
    <div
      ref={ref}
      className="fixed z-[9999] min-w-[180px] rounded-lg border border-border bg-popover/95 backdrop-blur-md shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: pos.x, top: pos.y }}
    >
      {visibleItems.map((item, i) => (
        <button
          key={i}
          className="flex w-full items-center gap-2.5 px-3 py-1.5 text-[13px] text-popover-foreground hover:bg-accent/80 hover:text-accent-foreground transition-colors"
          onClick={() => { item.action(); onClose() }}
        >
          <span className="text-muted-foreground">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

function ImageGrid({ images, backupId, folderPath, onContextMenu, onImageClick }: { images: BackupAttachment[]; backupId: string; folderPath: string; onContextMenu: (e: React.MouseEvent, att: BackupAttachment, url: string) => void; onImageClick: (att: BackupAttachment) => void }) {
  const urls = images.map((att) => resolveAssetUrl(backupId, att))
  const count = images.length

  if (count === 1) {
    return (
      <div className="mt-1.5">
        <div onContextMenu={(e) => onContextMenu(e, images[0], urls[0])} onClick={() => onImageClick(images[0])} className="cursor-pointer inline-block">
          <img
            src={urls[0]}
            alt={images[0].name}
            className="max-w-[400px] max-h-[300px] rounded-lg object-cover hover:opacity-90 transition-opacity"
            loading="lazy"
            onError={imgFallback(FALLBACK_IMAGE)}
          />
        </div>
      </div>
    )
  }

  if (count === 2) {
    return (
      <div className="mt-1.5 flex gap-1 max-w-[400px] max-h-[300px] rounded-lg overflow-hidden">
        {urls.map((url, i) => (
          <div key={images[i].id} onContextMenu={(e) => onContextMenu(e, images[i], url)} onClick={() => onImageClick(images[i])} className="flex-1 min-w-0 cursor-pointer">
            <img
              src={url}
              alt={images[i].name}
              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
              loading="lazy"
              onError={imgFallback(FALLBACK_IMAGE)}
            />
          </div>
        ))}
      </div>
    )
  }

  if (count === 3) {
    return (
      <div className="mt-1.5 flex gap-1 max-w-[400px] h-[300px] rounded-lg overflow-hidden">
        <div onContextMenu={(e) => onContextMenu(e, images[0], urls[0])} onClick={() => onImageClick(images[0])} className="flex-1 min-w-0 cursor-pointer">
          <img
            src={urls[0]}
            alt={images[0].name}
            className="w-full h-full object-cover hover:opacity-90 transition-opacity"
            loading="lazy"
            onError={imgFallback(FALLBACK_IMAGE)}
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {[1, 2].map((i) => (
            <div key={images[i].id} onContextMenu={(e) => onContextMenu(e, images[i], urls[i])} onClick={() => onImageClick(images[i])} className="flex-1 min-h-0 cursor-pointer">
              <img
                src={urls[i]}
                alt={images[i].name}
                className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                loading="lazy"
                onError={imgFallback(FALLBACK_IMAGE)}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-1.5 grid grid-cols-2 gap-1 max-w-[400px] rounded-lg overflow-hidden">
      {urls.map((url, i) => (
        <div key={images[i].id} onContextMenu={(e) => onContextMenu(e, images[i], url)} onClick={() => onImageClick(images[i])} className="cursor-pointer">
          <img
            src={url}
            alt={images[i].name}
            className="w-full h-[148px] object-cover hover:opacity-90 transition-opacity"
            loading="lazy"
            onError={imgFallback(FALLBACK_IMAGE)}
          />
        </div>
      ))}
    </div>
  )
}

function AudioPlayer({ url, name, size, contentType }: { url: string; name: string; size: number; contentType: string | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [waveform] = useState(() =>
    Array.from({ length: 32 }, () => 0.15 + Math.random() * 0.85)
  )

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onLoaded = () => setDuration(audio.duration || 0)
    const onTime = () => setCurrentTime(audio.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    audio.addEventListener("loadedmetadata", onLoaded)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("ended", onEnded)
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded)
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("ended", onEnded)
    }
  }, [])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause() } else { audio.play() }
    setPlaying(!playing)
  }

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2]
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audioRef.current.currentTime = pct * duration
    setCurrentTime(pct * duration)
  }

  const progress = duration > 0 ? currentTime / duration : 0

  const fmt = (t: number) => {
    if (!t || !isFinite(t)) return "0:00"
    const m = Math.floor(t / 60)
    const s = Math.floor(t % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="mt-1.5 flex items-center gap-3 rounded-lg bg-[#2b2d31] p-3 max-w-[320px]">
      <audio ref={audioRef} preload="metadata" src={url} />

      <button
        onClick={togglePlay}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/15 transition-colors"
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <rect x="2" y="1" width="3.5" height="12" rx="1" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="white">
            <path d="M3 1.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-end gap-[2px] h-6 cursor-pointer" onClick={seek}>
          {waveform.map((h, i) => {
            const barProgress = i / waveform.length
            const isPlayed = barProgress < progress
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-colors duration-75"
                style={{
                  height: `${h * 100}%`,
                  minWidth: 2,
                  backgroundColor: isPlayed ? "#fff" : "rgba(255,255,255,0.25)",
                }}
              />
            )
          })}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[11px] text-[#a3a6aa] font-mono">
            {playing || currentTime > 0 ? fmt(currentTime) : fmt(duration)}
          </span>
          <span className="text-[11px] text-[#a3a6aa]">{formatSize(size)}</span>
        </div>
      </div>

      <button
        onClick={cycleSpeed}
        className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-white/70 hover:bg-white/15 hover:text-white transition-colors"
      >
        {speed}X
      </button>

      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 text-white/50">
        <path d="M8 3L4.5 6H2v4h2.5L8 13V3z" fill="currentColor" />
        <path d="M10.5 5.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 4a5.5 5.5 0 010 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function AttachmentView({ att, backupId, onContextMenu }: { att: BackupAttachment; backupId: string; onContextMenu: (e: React.MouseEvent, att: BackupAttachment, url: string) => void }) {
  const url = resolveAssetUrl(backupId, att)
  const isVideo = att.contentType?.startsWith("video/")
  const isAudio = att.contentType?.startsWith("audio/")

  if (isVideo) {
    return (
      <div className="mt-1.5 max-w-[400px]" onContextMenu={(e) => onContextMenu(e, att, url)}>
        <video controls preload="metadata" className="w-full rounded-lg">
          <source src={url} type={att.contentType || "video/mp4"} />
        </video>
        <div className="mt-1 text-[11px] text-muted-foreground">📹 {att.name}</div>
      </div>
    )
  }

  if (isAudio) {
    return (
      <div onContextMenu={(e) => onContextMenu(e, att, url)}>
        <AudioPlayer url={url} name={att.name} size={att.size} contentType={att.contentType} />
      </div>
    )
  }

  return (
    <div
      className="mt-1.5 inline-flex items-center gap-3 rounded-lg bg-secondary/20 border border-border p-3 max-w-[350px]"
      onContextMenu={(e) => onContextMenu(e, att, url)}
    >
      <FileText size={20} className="shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{att.name}</div>
        <div className="text-[11px] text-muted-foreground">{formatSize(att.size)}</div>
      </div>
      <a
        href={url}
        download={att.name}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
      >
        <Download size={14} className="text-muted-foreground hover:text-primary transition-colors" />
      </a>
    </div>
  )
}

function EmbedView({ embed }: { embed: BackupEmbed }) {
  const borderColor = embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#202225"
  const isImageEmbed = embed.type === "image" && !embed.title && !embed.description
  const isVideoEmbed = embed.type === "video" && embed.video
  const isGifv = embed.type === "gifv" && embed.video

  if (isImageEmbed && embed.thumbnail) {
    return (
      <div className="mt-1.5">
        <a href={embed.url || embed.thumbnail.url} target="_blank" rel="noopener noreferrer">
          <img
            src={embed.thumbnail.url}
            alt="image"
            className="max-w-[400px] max-h-[300px] rounded-lg object-contain hover:opacity-90 transition-opacity cursor-pointer"
            loading="lazy"
            onError={imgFallback(FALLBACK_IMAGE)}
          />
        </a>
      </div>
    )
  }

  if (isGifv && embed.video) {
    return (
      <div className="mt-1.5">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="max-w-[400px] max-h-[300px] rounded-lg"
          src={embed.video.url}
        />
      </div>
    )
  }

  if (isVideoEmbed && !embed.title && !embed.description && embed.video) {
    return (
      <div className="mt-1.5 max-w-[400px]">
        {embed.thumbnail ? (
          <a href={embed.url || embed.video.url} target="_blank" rel="noopener noreferrer">
            <img
              src={embed.thumbnail.url}
              alt="video"
              className="rounded-lg object-contain hover:opacity-90 transition-opacity cursor-pointer max-w-[400px] max-h-[225px]"
              loading="lazy"
              onError={imgFallback(FALLBACK_IMAGE)}
            />
          </a>
        ) : (
          <video controls preload="metadata" className="w-full rounded-lg">
            <source src={embed.video.url} />
          </video>
        )}
      </div>
    )
  }

  return (
    <div
      className="mt-1.5 max-w-[520px] rounded overflow-hidden flex"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex-1 bg-[#2b2d31] p-3 min-w-0">
        {embed.provider?.name && (
          <div className="text-[11px] text-muted-foreground mb-1">{embed.provider.name}</div>
        )}

        {embed.author && (
          <div className="flex items-center gap-1.5 mb-1">
            {embed.author.iconUrl && (
              <img src={embed.author.iconUrl} alt="" className="h-5 w-5 rounded-full" loading="lazy" onError={imgFallback(FALLBACK_ICON)} />
            )}
            {embed.author.url ? (
              <a href={embed.author.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-foreground hover:underline"
                dangerouslySetInnerHTML={{ __html: processContent(embed.author.name) }}
              />
            ) : (
              <span className="text-xs font-semibold text-foreground" dangerouslySetInnerHTML={{ __html: processContent(embed.author.name) }} />
            )}
          </div>
        )}

        {embed.title && (
          embed.url ? (
            <a href={embed.url} target="_blank" rel="noopener noreferrer" className="block text-sm font-semibold text-[#00a8fc] hover:underline mb-1 break-words"
              dangerouslySetInnerHTML={{ __html: processContent(embed.title) }}
            />
          ) : (
            <div className="text-sm font-semibold text-foreground mb-1 break-words" dangerouslySetInnerHTML={{ __html: processContent(embed.title) }} />
          )
        )}

        {embed.description && (
          <div
            className="text-[13px] leading-relaxed text-foreground/80 mb-2 break-words"
            dangerouslySetInnerHTML={{ __html: processContent(embed.description) }}
          />
        )}

        {embed.fields.length > 0 && (
          <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 mb-2">
            {embed.fields.map((field, i) => (
              <div key={i} className={field.inline ? "min-w-0" : "col-span-full"}>
                <div className="text-xs font-semibold text-foreground mb-0.5" dangerouslySetInnerHTML={{ __html: processContent(field.name) }} />
                <div
                  className="text-[13px] text-foreground/80 break-words"
                  dangerouslySetInnerHTML={{ __html: processContent(field.value) }}
                />
              </div>
            ))}
          </div>
        )}

        {embed.image && (
          <a href={embed.image.url} target="_blank" rel="noopener noreferrer" className="block mt-2">
            <img
              src={embed.image.url}
              alt=""
              className="max-w-full max-h-[300px] rounded object-contain"
              loading="lazy"
              onError={imgFallback(FALLBACK_IMAGE)}
            />
          </a>
        )}

        {embed.video && embed.title && (
          <div className="mt-2">
            {embed.thumbnail ? (
              <a href={embed.url || embed.video.url} target="_blank" rel="noopener noreferrer" className="block relative group">
                <img
                  src={embed.thumbnail.url}
                  alt=""
                  className="max-w-full max-h-[225px] rounded object-contain"
                  loading="lazy"
                  onError={imgFallback(FALLBACK_IMAGE)}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-12 w-12 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                    <div className="ml-1 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[14px] border-l-white" />
                  </div>
                </div>
              </a>
            ) : (
              <video controls preload="metadata" className="max-w-full rounded">
                <source src={embed.video.url} />
              </video>
            )}
          </div>
        )}

        {(embed.footer || embed.timestamp) && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            {embed.footer?.iconUrl && (
              <img src={embed.footer.iconUrl} alt="" className="h-4 w-4 rounded-full shrink-0" loading="lazy" onError={imgFallback(FALLBACK_ICON)} />
            )}
            {embed.footer?.text && <span dangerouslySetInnerHTML={{ __html: processContent(embed.footer.text, true) }} />}
            {embed.footer?.text && embed.timestamp && <span>•</span>}
            {embed.timestamp && <span className="shrink-0">{formatFullDate(new Date(embed.timestamp).getTime())}</span>}
          </div>
        )}
      </div>

      {embed.thumbnail && !embed.image && !embed.video && (
        <div className="bg-[#2b2d31] p-3 pl-0 shrink-0">
          <img
            src={embed.thumbnail.url}
            alt=""
            className="w-20 h-20 rounded object-cover"
            loading="lazy"
            onError={imgFallback(FALLBACK_IMAGE)}
          />
        </div>
      )}
    </div>
  )
}

function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m < 60) return s > 0 ? `${m} minutos e ${s} segundos` : `${m} minutos`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h} horas e ${rm} minutos` : `${h} horas`
}

function StickerView({ s }: { s: BackupSticker }) {
  const [lottieData, setLottieData] = useState<object | null>(null)
  const [mode, setMode] = useState<"loading" | "lottie" | "image" | "error">("loading")
  const [imgSrc, setImgSrc] = useState(s.url)
  const imgFallbackTried = useRef(false)

  useEffect(() => {
    let cancelled = false
    const proxyUrl = `${API_BASE}/backups/sticker-lottie/${s.id}`

    fetch(proxyUrl)
      .then((r) => {
        if (!r.ok) throw new Error("not-lottie")
        return r.json()
      })
      .then((data) => {
        if (!cancelled) {
          setLottieData(data)
          setMode("lottie")
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (s.format === "lottie") {
            setMode("error")
          } else {
            setMode("image")
          }
        }
      })

    return () => { cancelled = true }
  }, [s.id, s.format])

  if (mode === "loading") {
    return <div className="mt-1.5 w-40 h-40 rounded-lg bg-secondary/10 animate-pulse" title={s.name} />
  }

  if (mode === "lottie" && lottieData) {
    return (
      <div className="mt-1.5" title={s.name}>
        <Lottie animationData={lottieData} loop autoplay style={{ width: 160, height: 160 }} />
      </div>
    )
  }

  if (mode === "error") {
    return (
      <div className="mt-1.5 w-40 h-40 flex items-center justify-center rounded-lg bg-secondary/20 border border-border" title={s.name}>
        <span className="text-xs text-muted-foreground">Sticker: {s.name}</span>
      </div>
    )
  }

  const handleImgError = () => {
    if (!imgFallbackTried.current) {
      imgFallbackTried.current = true
      setImgSrc(`https://media.discordapp.net/stickers/${s.id}.webp?size=320`)
    } else {
      setMode("error")
    }
  }

  return (
    <div className="mt-1.5" title={s.name}>
      <img src={imgSrc} alt={s.name} className="w-40 h-40 object-contain" loading="lazy" onError={handleImgError} />
    </div>
  )
}

function CallMessage({ msg }: { msg: BackupMessage }) {
  const isMissed = msg.call?.duration === null || msg.call?.duration === 0
  const authorName = msg.author.globalName || msg.author.username

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className={`shrink-0 p-2 rounded-full ${isMissed ? "bg-red-500/10" : "bg-green-500/10"}`}>
        {isMissed ? (
          <PhoneMissed size={16} className="text-red-400" />
        ) : (
          <Phone size={16} className="text-green-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-foreground/90">
          {isMissed ? (
            <>Você perdeu uma chamada de <strong>{authorName}</strong> que durou poucos segundos.</>
          ) : (
            <>
              <strong>{authorName}</strong> iniciou uma chamada
              {msg.call?.duration != null && ` que durou ${formatCallDuration(msg.call.duration)}`}.
            </>
          )}
        </div>
      </div>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        {formatFullDate(msg.createdTimestamp)}
      </span>
    </div>
  )
}

function MessageItem({ msg, prev, backupId, folderPath, onAttachmentContextMenu, onImageClick }: { msg: BackupMessage; prev: BackupMessage | null; backupId: string; folderPath: string; onAttachmentContextMenu: (e: React.MouseEvent, att: BackupAttachment, url: string) => void; onImageClick: (att: BackupAttachment) => void }) {
  const firstInGroup = isNewGroup(msg, prev)
  const showDate = !prev || isDifferentDay(msg.createdTimestamp, prev.createdTimestamp)
  const displayName = msg.author.globalName || msg.author.username
  const showUsername = msg.author.globalName && msg.author.globalName !== msg.author.username

  if (msg.type === 'CALL') {
    return (
      <>
        {showDate && <DateSeparator timestamp={msg.createdTimestamp} />}
        <CallMessage msg={msg} />
      </>
    )
  }

  const contentBlock = (
    <>
      {msg.content && (
        <div
          className="text-sm leading-relaxed text-foreground/90 break-words mt-0.5"
          dangerouslySetInnerHTML={{ __html: processContent(msg.content) }}
        />
      )}
      {(() => {
        const imageAtts = msg.attachments.filter((a) => a.contentType?.startsWith("image/"))
        const otherAtts = msg.attachments.filter((a) => !a.contentType?.startsWith("image/"))
        return (
          <>
            {imageAtts.length > 0 && <ImageGrid images={imageAtts} backupId={backupId} folderPath={folderPath} onContextMenu={onAttachmentContextMenu} onImageClick={onImageClick} />}
            {otherAtts.map((att) => (
              <AttachmentView key={att.id} att={att} backupId={backupId} onContextMenu={onAttachmentContextMenu} />
            ))}
          </>
        )
      })()}
      {msg.embeds.map((embed, i) => (
        <EmbedView key={`embed-${i}`} embed={embed} />
      ))}
      {msg.stickers.map((s) => (
        <StickerView key={s.id} s={s} />
      ))}
    </>
  )

  return (
    <>
      {showDate && <DateSeparator timestamp={msg.createdTimestamp} />}

      {firstInGroup ? (
        <div className="group flex gap-4 px-4 py-1 hover:bg-secondary/20 rounded-sm mt-4 first:mt-0">
          <Avatar className="h-10 w-10 shrink-0 mt-0.5">
            <AvatarImage src={msg.author.avatarUrl} alt={displayName} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className={`text-sm font-semibold ${msg.author.bot ? "text-[#5865f2]" : "text-[#f2f3f5]"}`}>
                {displayName}
              </span>
              {showUsername && (
                <span className="text-[11px] text-muted-foreground">({msg.author.username})</span>
              )}
              {msg.author.bot && (
                <span className="inline-flex items-center rounded bg-[#5865f2] px-1 py-px text-[10px] font-medium text-white">
                  BOT
                </span>
              )}
              <span className="text-[11px] text-muted-foreground" title={formatFullDate(msg.createdTimestamp)}>
                {formatFullDate(msg.createdTimestamp)}
              </span>
            </div>
            {contentBlock}
          </div>
        </div>
      ) : (
        <div className="group flex gap-4 px-4 py-px hover:bg-secondary/20 rounded-sm">
          <div className="w-10 shrink-0 flex items-start justify-center">
            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 mt-1 tabular-nums">
              {formatTimestamp(msg.createdTimestamp)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            {contentBlock}
          </div>
        </div>
      )}
    </>
  )
}

function BackupViewer({ backup, onBack }: { backup: BackupMeta; onBack: () => void }) {
  const [data, setData] = useState<BackupData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [visibleCount, setVisibleCount] = useState(200)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null)
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'images' | 'videos' | 'audio' | 'files' | 'links'>('all')
  const [searchText, setSearchText] = useState("")

  const handleAttachmentContextMenu = useCallback((e: React.MouseEvent, att: BackupAttachment, url: string) => {
    e.preventDefault()
    e.stopPropagation()
    const localFullPath = att.localPath ? `${backup.folderPath}\\${att.localPath.replace(/\//g, "\\")}` : null
    setCtxMenu({ x: e.clientX, y: e.clientY, att, url, localFullPath })
  }, [backup.folderPath])

  useEffect(() => {
    setLoading(true)
    setError("")
    api.getBackupData(backup.id)
      .then((res) => setData(res.data as BackupData))
      .catch((err) => setError(err instanceof Error ? err.message : "Erro ao carregar backup"))
      .finally(() => setLoading(false))
  }, [backup.id])

  const messages = data?.messages || []

  const filteredMessages = useMemo(() => {
    let msgs = messages
    if (filterType !== 'all') {
      msgs = msgs.filter(m => {
        switch (filterType) {
          case 'images': return m.attachments.some(a => a.contentType?.startsWith('image/'))
          case 'videos': return m.attachments.some(a => a.contentType?.startsWith('video/'))
          case 'audio': return m.attachments.some(a => a.contentType?.startsWith('audio/'))
          case 'files': return m.attachments.length > 0 && m.attachments.some(a => !a.contentType?.startsWith('image/') && !a.contentType?.startsWith('video/') && !a.contentType?.startsWith('audio/'))
          case 'links': return /https?:\/\/[^\s]+/.test(m.content)
          default: return true
        }
      })
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      msgs = msgs.filter(m =>
        m.content.toLowerCase().includes(q) ||
        m.author.username.toLowerCase().includes(q) ||
        (m.author.globalName && m.author.globalName.toLowerCase().includes(q)) ||
        m.attachments.some(a => a.name.toLowerCase().includes(q))
      )
    }
    return msgs
  }, [messages, filterType, searchText])

  useEffect(() => { setVisibleCount(200) }, [filterType, searchText])

  const allImages = useMemo(() => {
    const imgs: LightboxImage[] = []
    for (const msg of messages) {
      for (const att of msg.attachments) {
        if (att.contentType?.startsWith("image/")) {
          imgs.push({ att, url: resolveAssetUrl(backup.id, att) })
        }
      }
    }
    return imgs
  }, [messages, backup.id])

  const handleImageClick = useCallback((att: BackupAttachment) => {
    const idx = allImages.findIndex((img) => img.att.id === att.id)
    if (idx >= 0) setLightbox({ images: allImages, index: idx })
  }, [allImages])

  const visibleMessages = filteredMessages.slice(0, visibleCount)
  const hasMore = visibleCount < filteredMessages.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeft size={16} className="mr-1" /> Voltar
        </Button>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="shrink-0 flex items-center gap-4 pb-4 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ChevronLeft size={18} />
        </Button>
        <Avatar className="h-10 w-10 border border-border">
          <AvatarImage src={backup.avatarUrl || undefined} alt={backup.username} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {backup.username.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{backup.username}</span>
            <BadgeRow badges={backup.badges} />
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{messages.length.toLocaleString()} mensagens</span>
            <span>·</span>
            <span>{backup.totalAttachments} anexos</span>
            <span>·</span>
            <span>{formatDate(backup.createdAt)}</span>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => { try { window.electronAPI?.shell.openPath(backup.folderPath) } catch {} }}
            >
              <FolderOpen size={15} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Abrir pasta</TooltipContent>
        </Tooltip>
      </div>

      <div className="shrink-0 flex flex-wrap items-center gap-2 py-3 border-b border-border">
        <div className="relative flex-1 min-w-[180px] max-w-[280px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Buscar mensagens..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary/30 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="flex items-center gap-1">
          {([
            { key: 'all', label: 'Tudo', icon: null },
            { key: 'images', label: 'Imagens', icon: Image },
            { key: 'videos', label: 'Vídeos', icon: Video },
            { key: 'audio', label: 'Áudio', icon: Music2 },
            { key: 'files', label: 'Arquivos', icon: FileText },
            { key: 'links', label: 'Links', icon: Link2 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilterType(key as typeof filterType)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterType === key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {Icon && <Icon size={13} />}
              {label}
            </button>
          ))}
        </div>
        {(filterType !== 'all' || searchText.trim()) && (
          <span className="text-[11px] text-muted-foreground ml-1">
            {filteredMessages.length.toLocaleString()} de {messages.length.toLocaleString()}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4" ref={scrollRef}>
        {visibleMessages.map((msg, i) => (
          <MessageItem
            key={msg.id}
            msg={msg}
            prev={i > 0 ? visibleMessages[i - 1] : null}
            backupId={backup.id}
            folderPath={backup.folderPath}
            onAttachmentContextMenu={handleAttachmentContextMenu}
            onImageClick={handleImageClick}
          />
        ))}

        {hasMore && (
          <div className="flex justify-center py-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibleCount((c) => c + 200)}
              className="text-xs"
            >
              <ArrowDown size={14} className="mr-1.5" />
              Carregar mais ({(filteredMessages.length - visibleCount).toLocaleString()} restantes)
            </Button>
          </div>
        )}

        {!hasMore && filteredMessages.length > 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">
              {filterType !== 'all' || searchText.trim()
                ? `${filteredMessages.length.toLocaleString()} mensagens filtradas de ${messages.length.toLocaleString()}`
                : `Início da conversa — ${messages.length.toLocaleString()} mensagens`
              }
            </p>
          </div>
        )}
      </div>

      {ctxMenu && <AttachmentContextMenu menu={ctxMenu} onClose={() => setCtxMenu(null)} />}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
          onContextMenu={handleAttachmentContextMenu}
        />
      )}
    </div>
  )
}

export default function PaginaBackups() {
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [selectedBackup, setSelectedBackup] = useState<BackupMeta | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'most-messages' | 'most-attachments'>('newest')

  const fetchBackups = async () => {
    try {
      const res = await api.getBackups()
      setBackups((res.data || []) as BackupMeta[])
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchBackups() }, [])

  const filteredBackups = useMemo(() => {
    let filtered = backups
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(b =>
        b.username.toLowerCase().includes(q) ||
        b.userId.includes(q)
      )
    }
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'most-messages': return b.totalMessages - a.totalMessages
        case 'most-attachments': return b.totalAttachments - a.totalAttachments
      }
    })
  }, [backups, searchQuery, sortBy])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeleting(id)
    try {
      await api.deleteBackup(id)
      setBackups((prev) => prev.filter((b) => b.id !== id))
    } catch {} finally {
      setDeleting(null)
    }
  }

  if (selectedBackup) {
    return <BackupViewer backup={selectedBackup} onBack={() => setSelectedBackup(null)} />
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Archive size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">Backups</h1>
          <p className="text-xs text-muted-foreground">
            {backups.length === 0
              ? "Nenhum backup salvo"
              : `${backups.length} backup${backups.length !== 1 ? "s" : ""} salvo${backups.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {backups.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou ID..."
              className="w-full h-9 pl-9 pr-3 rounded-xl bg-card/40 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9 px-3 rounded-xl bg-card/40 border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
          >
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="most-messages">Mais mensagens</option>
            <option value="most-attachments">Mais anexos</option>
          </select>
        </div>
      )}

      {backups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/50">
            <Archive size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium text-foreground">Nenhum backup ainda</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Ative a opção &quot;Fazer backup&quot; na tela de Limpar DM para salvar conversas antes de apagar
          </p>
        </div>
      ) : filteredBackups.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum backup encontrado para &quot;{searchQuery}&quot;</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBackups.map((backup) => (
            <div
              key={backup.id}
              onClick={() => setSelectedBackup(backup)}
              className="group cursor-pointer rounded-xl border border-border bg-card/40 p-5 transition-all hover:bg-card/60 hover:border-primary/20"
            >
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12 border border-border shrink-0">
                  <AvatarImage src={backup.avatarUrl || undefined} alt={backup.username} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {backup.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{backup.username}</span>
                    <BadgeRow badges={backup.badges} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">ID: {backup.userId}</div>

                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare size={12} className="text-primary/70" />
                      <span className="tabular-nums font-medium text-foreground">{backup.totalMessages.toLocaleString()}</span>
                      <span>mensagens</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Paperclip size={12} className="text-primary/70" />
                      <span className="tabular-nums font-medium text-foreground">{backup.totalAttachments}</span>
                      <span>anexos</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {backup.savedMediaLocally ? (
                        <><HardDrive size={12} className="text-green-400" /><span className="text-green-400 font-medium">Mídia local</span></>
                      ) : (
                        <><Cloud size={12} className="text-yellow-400" /><span className="text-yellow-400 font-medium">Apenas URLs</span></>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock size={12} />
                      <span>{formatDate(backup.createdAt)}</span>
                    </div>
                    {backup.durationSeconds > 0 && (
                      <div className="text-xs text-muted-foreground">
                        ⏱ {formatDuration(backup.durationSeconds)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          try { window.electronAPI?.shell.openPath(backup.folderPath) } catch {}
                        }}
                      >
                        <FolderOpen size={15} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Abrir pasta</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        disabled={deleting === backup.id}
                        onClick={(e) => handleDelete(e, backup.id)}
                      >
                        {deleting === backup.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir backup</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
