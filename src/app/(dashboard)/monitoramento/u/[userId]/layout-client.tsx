
import { useState, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { useParams, useLocation } from "react-router-dom"
import {
  Home,
  MessageSquare,
  Trash2,
  AtSign,
  ImageIcon,
  Phone,
  Users,
  ArrowLeft,
  Volume2,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { api } from "@/lib/api-client"
import { useWSEvent } from "@/hooks/use-websocket"
import type { MonitoredUser, VoiceEvent } from "@/types/monitoring"

interface NavItem {
  label: string
  icon: React.ReactNode
  href: string
}

function buildNav(userId: string): NavItem[] {
  const base = `/monitoramento/u/${userId}`
  return [
    { label: "Geral", icon: <Home size={15} />, href: base },
    { label: "Calls", icon: <Phone size={15} />, href: `${base}/calls` },
    { label: "Mensagens", icon: <MessageSquare size={15} />, href: `${base}/mensagens` },
    { label: "Deletadas", icon: <Trash2 size={15} />, href: `${base}/deletadas` },
    { label: "Menções", icon: <AtSign size={15} />, href: `${base}/mencoes` },
    { label: "Mídia", icon: <ImageIcon size={15} />, href: `${base}/midia` },
    { label: "Interações", icon: <Users size={15} />, href: `${base}/interacoes` },
  ]
}

export function MonitoramentoUserLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = useLocation().pathname
  const userId = params.userId as string
  const [user, setUser] = useState<MonitoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  const nav = buildNav(userId)

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.getMonitoredUsers()
      const users = (res.data || []) as MonitoredUser[]
      const found = users.find(u => u.userId === userId)
      setUser(found || null)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetchUser() }, [fetchUser])

  useWSEvent<VoiceEvent>("monitoring:voice_event", (event) => {
    if (event.userId !== userId) return
    setUser(prev => {
      if (!prev) return prev
      if (event.type === "join" || event.type === "move") {
        return {
          ...prev,
          isOnline: true,
          currentVoiceChannel: {
            channelId: event.channelId,
            channelName: event.channelName,
            guildId: event.guildId,
            guildName: event.guildName,
            guildIcon: event.guildIcon,
          },
        }
      }
      if (event.type === "leave") {
        return { ...prev, isOnline: false, currentVoiceChannel: null }
      }
      return prev
    })
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="flex items-center gap-4 px-6 py-4">
          <Link
            to="/monitoramento"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ArrowLeft size={15} />
          </Link>

          {user && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative">
                <Avatar className="h-9 w-9 ring-2 ring-background">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                    user.isOnline ? "bg-emerald-400" : "bg-zinc-600"
                  )}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold truncate">{user.username}</h2>
                  <span className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                    user.isOnline
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-zinc-500/10 text-zinc-500"
                  )}>
                    {user.isOnline ? "Online" : "Offline"}
                  </span>
                </div>
                {user.currentVoiceChannel ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Volume2 size={11} className="text-emerald-400 shrink-0" />
                    <span className="text-[11px] text-emerald-400 truncate">
                      {user.currentVoiceChannel.channelName}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      — {user.currentVoiceChannel.guildName}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {user.userId}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 px-6 -mb-px overflow-x-auto scrollbar-none">
          {nav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
