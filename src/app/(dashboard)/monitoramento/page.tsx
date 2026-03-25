
import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  Eye,
  Radio,
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
  Settings,
  Loader2,
  ChevronRight,
  History,
  Signal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useWSEvent } from "@/hooks/use-websocket"
import { api } from "@/lib/api-client"
import type { MonitoredUser, VoiceEvent, CallSession } from "@/types/monitoring"

const EVENT_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  join: { label: "Entrou na call", icon: <Phone size={14} />, color: "text-emerald-400" },
  leave: { label: "Saiu da call", icon: <PhoneOff size={14} />, color: "text-red-400" },
  move: { label: "Mudou de canal", icon: <ArrowRight size={14} />, color: "text-blue-400" },
  camera_on: { label: "Ligou a câmera", icon: <Camera size={14} />, color: "text-violet-400" },
  camera_off: { label: "Desligou a câmera", icon: <CameraOff size={14} />, color: "text-zinc-400" },
  screen_on: { label: "Compartilhou tela", icon: <Monitor size={14} />, color: "text-cyan-400" },
  screen_off: { label: "Parou de compartilhar", icon: <MonitorOff size={14} />, color: "text-zinc-400" },
  mute: { label: "Mutou", icon: <MicOff size={14} />, color: "text-yellow-400" },
  unmute: { label: "Desmutou", icon: <Mic size={14} />, color: "text-emerald-400" },
  deaf: { label: "Ensurdeceu", icon: <VolumeX size={14} />, color: "text-orange-400" },
  undeaf: { label: "Desensurdeceu", icon: <Volume2 size={14} />, color: "text-emerald-400" },
  server_mute: { label: "Mutado pelo server", icon: <MicOff size={14} />, color: "text-red-400" },
  server_unmute: { label: "Desmutado pelo server", icon: <Mic size={14} />, color: "text-green-400" },
  server_deaf: { label: "Ensurdecido pelo server", icon: <VolumeX size={14} />, color: "text-red-400" },
  server_undeaf: { label: "Desensurdecido pelo server", icon: <Volume2 size={14} />, color: "text-green-400" },
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

export default function PaginaMonitoramento() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<MonitoredUser[]>([])
  const [activeSessions, setActiveSessions] = useState<CallSession[]>([])
  const [liveEvents, setLiveEvents] = useState<VoiceEvent[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [userSessions, setUserSessions] = useState<CallSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [connectedTokens, setConnectedTokens] = useState(0)
  const [totalTokens, setTotalTokens] = useState(0)
  const feedRef = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getMonitoringStatus()
      const data = res.data as any
      setUsers(data.users || [])
      setActiveSessions(data.activeSessions || [])
      setConnectedTokens(data.connectedTokens || 0)
      setTotalTokens(data.totalTokens || 0)
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useWSEvent<VoiceEvent>("monitoring:voice_event", (event) => {
    setLiveEvents(prev => [event, ...prev].slice(0, 200))

    setUsers(prev => prev.map(u => {
      if (u.userId !== event.userId) return u
      if (event.type === "join" || event.type === "move") {
        return {
          ...u,
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
        return { ...u, isOnline: false, currentVoiceChannel: null }
      }
      return u
    }))
  })

  useWSEvent<CallSession>("monitoring:session_start", (session) => {
    setActiveSessions(prev => [...prev, session])
  })

  useWSEvent<CallSession>("monitoring:session_end", (session) => {
    setActiveSessions(prev => prev.filter(s => s.id !== session.id))
    if (selectedUser === session.userId) {
      loadUserSessions(session.userId)
    }
  })

  const loadUserSessions = async (userId: string) => {
    setLoadingSessions(true)
    try {
      const res = await api.getUserSessions(userId, 20)
      setUserSessions((res.data || []) as CallSession[])
    } catch {
      setUserSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleSelectUser = (userId: string) => {
    if (selectedUser === userId) {
      setSelectedUser(null)
      setUserSessions([])
    } else {
      setSelectedUser(userId)
      loadUserSessions(userId)
    }
  }

  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const int = setInterval(() => forceUpdate(v => v + 1), 1000)
    return () => clearInterval(int)
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const onlineUsers = users.filter(u => u.isOnline)

  return (
    <div className="flex h-full">
      <div className="w-80 flex-shrink-0 border-r border-border overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Monitoramento</h1>
              <p className="text-xs text-muted-foreground">
                <span className="text-emerald-400">{connectedTokens}</span>/{totalTokens} tokens •{" "}
                <span className="text-emerald-400">{onlineUsers.length}</span>/{users.length} online
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => navigate("/monitoramento/config")}
            >
              <Settings size={16} />
            </Button>
          </div>

          {users.length === 0 ? (
            <div className="text-center py-12">
              <Eye size={40} className="mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum usuário monitorado</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => navigate("/monitoramento/config")}
              >
                <Settings size={14} className="mr-1" /> Configurar
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground px-1 mb-2">
                  USUÁRIOS ({users.length})
                </p>
                {users.map((user) => {
                  const active = activeSessions.find(s => s.userId === user.userId && s.active)
                  const isSelected = selectedUser === user.userId
                  return (
                    <div key={user.id} className="flex items-center gap-1">
                      <button
                        onClick={() => handleSelectUser(user.userId)}
                        className={`flex-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-secondary/50 border border-transparent"
                        }`}
                      >
                        <div className="relative">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback className="text-xs">{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                            user.isOnline ? "bg-emerald-500" : "bg-zinc-600"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.globalName || user.username}</p>
                          {active ? (
                            <p className="text-[10px] text-emerald-400 flex items-center gap-1 truncate">
                              <Radio size={8} className="animate-pulse shrink-0" />
                              {active.channelName} • {active.guildName}
                            </p>
                          ) : user.lastSeen ? (
                            <p className="text-[10px] text-muted-foreground truncate">
                              Visto: {formatTime(user.lastSeen)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground">Aguardando atividade...</p>
                          )}
                        </div>
                        <ChevronRight size={14} className={`text-muted-foreground/50 transition-transform ${isSelected ? "rotate-90" : ""}`} />
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => navigate(`/monitoramento/u/${user.userId}`)}
                        title="Ver detalhes"
                      >
                        <Eye size={12} />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {activeSessions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground px-1 mb-2 flex items-center gap-1">
                    <Radio size={10} className="text-emerald-400 animate-pulse" />
                    SESSÕES ATIVAS ({activeSessions.length})
                  </p>
                  {activeSessions.map((session) => (
                    <div
                      key={session.id}
                      className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {session.guildIcon ? (
                          <img src={session.guildIcon} alt="" className="h-5 w-5 rounded-full" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-zinc-700 flex items-center justify-center text-[8px]">S</div>
                        )}
                        <span className="text-xs font-medium truncate">{session.guildName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          #{session.channelName} • {session.username}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono">
                          {formatDuration(Date.now() - new Date(session.startedAt).getTime())}
                        </span>
                      </div>
                      {session.participants.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Users size={10} className="text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            +{session.participants.filter(p => !p.leftAt).length} na call
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedUser ? (
          <SelectedUserView
            userId={selectedUser}
            users={users}
            activeSessions={activeSessions}
            userSessions={userSessions}
            loadingSessions={loadingSessions}
            liveEvents={liveEvents}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-6 py-3">
              <Activity size={16} className="text-primary" />
              <h2 className="text-sm font-semibold">Feed em Tempo Real</h2>
              <span className="text-xs text-muted-foreground">({liveEvents.length} eventos)</span>
            </div>

            <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-1">
              {liveEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Signal size={48} className="text-muted-foreground/15 mb-3" />
                  <p className="text-sm text-muted-foreground">Aguardando eventos...</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Eventos de voice dos usuários monitorados aparecerão aqui em tempo real
                  </p>
                </div>
              ) : (
                liveEvents.map((event) => <EventRow key={event.id} event={event} />)
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function EventRow({ event }: { event: VoiceEvent }) {
  const meta = EVENT_META[event.type] || { label: event.type, icon: <Activity size={14} />, color: "text-zinc-400" }

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-secondary/30 transition-colors">
      <span className={`shrink-0 ${meta.color}`}>{meta.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{event.username}</span>{" "}
          <span className="text-muted-foreground">{meta.label.toLowerCase()}</span>
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          #{event.channelName} • {event.guildName}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
        {formatTime(event.timestamp)}
      </span>
    </div>
  )
}

function SelectedUserView({
  userId,
  users,
  activeSessions,
  userSessions,
  loadingSessions,
  liveEvents,
}: {
  userId: string
  users: MonitoredUser[]
  activeSessions: CallSession[]
  userSessions: CallSession[]
  loadingSessions: boolean
  liveEvents: VoiceEvent[]
}) {
  const navigate = useNavigate()
  const user = users.find(u => u.userId === userId)
  const activeSession = activeSessions.find(s => s.userId === userId && s.active)
  const userEvents = liveEvents.filter(e => e.userId === userId)

  if (!user) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
              user.isOnline ? "bg-emerald-500" : "bg-zinc-600"
            }`} />
          </div>
          <div>
            <h2 className="text-lg font-bold">{user.globalName || user.username}</h2>
            <p className="text-xs text-muted-foreground font-mono">{user.userId}</p>
          </div>
          {activeSession && (
            <div className="ml-auto flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
              <Radio size={12} className="text-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">
                Em call: #{activeSession.channelName}
              </span>
              <span className="text-xs text-emerald-400/60 font-mono">
                {formatDuration(Date.now() - new Date(activeSession.startedAt).getTime())}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col border-r border-border overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/20">
            <Activity size={14} className="text-primary" />
            <span className="text-xs font-semibold">Eventos Recentes</span>
            <span className="text-[10px] text-muted-foreground">({userEvents.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {userEvents.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">Nenhum evento ainda</p>
              </div>
            ) : (
              userEvents.map((event) => <EventRow key={event.id} event={event} />)
            )}
          </div>
        </div>

        <div className="w-96 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-secondary/20">
            <History size={14} className="text-primary" />
            <span className="text-xs font-semibold">Histórico de Calls</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loadingSessions ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : userSessions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs text-muted-foreground">Nenhuma sessão registrada</p>
              </div>
            ) : (
              userSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => navigate(`/monitoramento/sessao?userId=${session.userId}&sessionId=${session.id}`)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {session.guildIcon ? (
                      <img src={session.guildIcon} alt="" className="h-4 w-4 rounded-full" />
                    ) : (
                      <div className="h-4 w-4 rounded-full bg-zinc-700 flex items-center justify-center text-[7px]">S</div>
                    )}
                    <span className="text-xs font-medium truncate">{session.guildName}</span>
                    {session.active && (
                      <Radio size={10} className="text-emerald-400 animate-pulse ml-auto" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>#{session.channelName}</span>
                    <span className="font-mono">{formatDuration(session.totalDuration || (session.active ? Date.now() - new Date(session.startedAt).getTime() : 0))}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>{formatTime(session.startedAt)}{session.endedAt ? ` → ${formatTime(session.endedAt)}` : ""}</span>
                    <span className="flex items-center gap-1">
                      <Users size={8} /> {session.participants.length}
                      <span className="mx-0.5">•</span>
                      <Activity size={8} /> {session.events.length}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
