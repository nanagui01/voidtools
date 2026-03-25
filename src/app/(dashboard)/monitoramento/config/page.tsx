
import { useState, useEffect, useCallback } from "react"
import {
  Key,
  Plus,
  Trash2,
  Wifi,
  WifiOff,
  Loader2,
  UserPlus,
  Eye,
  Signal,
  AlertCircle,
  CheckCircle2,
  Users,
  Radio,
  Server,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useWSEvent } from "@/hooks/use-websocket"
import { api } from "@/lib/api-client"
import type { MonitoringToken, MonitoredUser } from "@/types/monitoring"

export default function PaginaMonitoramentoConfig() {
  const [tokens, setTokens] = useState<MonitoringToken[]>([])
  const [users, setUsers] = useState<MonitoredUser[]>([])
  const [loading, setLoading] = useState(true)
  const [newToken, setNewToken] = useState("")
  const [newUserId, setNewUserId] = useState("")
  const [addingToken, setAddingToken] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [connectingAll, setConnectingAll] = useState(false)
  const [error, setError] = useState("")
  const [tokenErrors, setTokenErrors] = useState<Record<string, string>>({})
  const [connectingTokens, setConnectingTokens] = useState<Set<string>>(new Set())

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getMonitoringStatus()
      const data = res.data as any
      setTokens(data.tokens || [])
      setUsers(data.users || [])
    } catch {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  useWSEvent<any>("monitoring:token_status", (data) => {
    setTokens(prev => prev.map(t => t.id === data.id ? { ...t, status: data.status, guildCount: data.guildCount ?? t.guildCount } : t))
    setConnectingTokens(prev => { const n = new Set(prev); n.delete(data.id); return n })
  })

  useWSEvent<MonitoredUser>("monitoring:user_added", (user) => {
    setUsers(prev => prev.some(u => u.id === user.id) ? prev : [...prev, user])
  })

  useWSEvent<any>("monitoring:user_removed", (data) => {
    setUsers(prev => prev.filter(u => u.id !== data.id))
  })

  const handleAddToken = async () => {
    if (!newToken.trim()) return
    setAddingToken(true)
    setError("")
    try {
      const res = await api.addMonitoringToken(newToken.trim())
      const data = res.data as MonitoringToken
      setTokens(prev => [...prev, data])
      setNewToken("")
    } catch (err: any) {
      setError(err.message || "Falha ao adicionar token")
    } finally {
      setAddingToken(false)
    }
  }

  const handleRemoveToken = async (id: string) => {
    try {
      await api.removeMonitoringToken(id)
      setTokens(prev => prev.filter(t => t.id !== id))
    } catch {}
  }

  const handleConnectToken = async (id: string) => {
    setConnectingTokens(prev => new Set(prev).add(id))
    setTokenErrors(prev => { const n = { ...prev }; delete n[id]; return n })
    try {
      await api.connectMonitoringToken(id)
    } catch (err: any) {
      setTokenErrors(prev => ({ ...prev, [id]: err.message }))
      setConnectingTokens(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  const handleDisconnectToken = async (id: string) => {
    try {
      await api.disconnectMonitoringToken(id)
    } catch {}
  }

  const handleConnectAll = async () => {
    setConnectingAll(true)
    try {
      await api.connectAllMonitoringTokens()
    } catch {}
    setConnectingAll(false)
  }

  const handleAddUser = async () => {
    if (!newUserId.trim()) return
    setAddingUser(true)
    setError("")
    try {
      await api.addMonitoredUser(newUserId.trim())
      setNewUserId("")
    } catch (err: any) {
      setError(err.message || "Falha ao adicionar usuário")
    } finally {
      setAddingUser(false)
    }
  }

  const handleRemoveUser = async (id: string) => {
    try {
      await api.removeMonitoredUser(id)
      setUsers(prev => prev.filter(u => u.id !== id))
    } catch {}
  }

  const connectedCount = tokens.filter(t => t.status === "connected").length
  const totalGuilds = tokens.reduce((acc, t) => acc + (t.guildCount || 0), 0)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuração de Monitoramento</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure tokens e usuários para monitoramento em tempo real
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Key size={14} />
            Tokens
          </div>
          <p className="text-2xl font-bold">{tokens.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Signal size={14} />
            Conectadas
          </div>
          <p className="text-2xl font-bold text-emerald-500">{connectedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Server size={14} />
            Servidores
          </div>
          <p className="text-2xl font-bold">{totalGuilds}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Eye size={14} />
            Monitorados
          </div>
          <p className="text-2xl font-bold">{users.length}</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError("")} className="ml-auto text-red-400/70 hover:text-red-400">✕</button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Tokens de Monitoramento</h2>
            <p className="text-xs text-muted-foreground">
              Essas tokens devem estar no máximo de servidores possíveis para cobrir o monitoramento
            </p>
          </div>
          {tokens.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectAll}
              disabled={connectingAll || connectedCount === tokens.length}
            >
              {connectingAll ? <Loader2 size={14} className="animate-spin mr-1" /> : <Wifi size={14} className="mr-1" />}
              Conectar Todas
            </Button>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Cole a token aqui..."
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddToken()}
            className="flex-1 font-mono text-xs"
            type="password"
          />
          <Button onClick={handleAddToken} disabled={addingToken || !newToken.trim()} size="sm">
            {addingToken ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
            Adicionar
          </Button>
        </div>

        {tokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <Key size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhuma token configurada</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Adicione tokens para começar o monitoramento</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <div
                key={token.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={token.avatarUrl} />
                  <AvatarFallback>{token.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{token.username}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      token.status === "connected"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : token.status === "connecting"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : token.status === "error"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-zinc-500/10 text-zinc-400"
                    }`}>
                      {token.status === "connected" && <><Radio size={8} className="animate-pulse" /> Conectada</>}
                      {token.status === "connecting" && <><Loader2 size={8} className="animate-spin" /> Conectando</>}
                      {token.status === "disconnected" && <><WifiOff size={8} /> Desconectada</>}
                      {token.status === "error" && <><AlertCircle size={8} /> Erro</>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {token.guildCount !== undefined && (
                      <span>{token.guildCount} servidores</span>
                    )}
                    {tokenErrors[token.id] && (
                      <span className="text-red-400">{tokenErrors[token.id]}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {token.status === "connected" ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-yellow-400"
                      onClick={() => handleDisconnectToken(token.id)}
                    >
                      <WifiOff size={14} />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-emerald-400"
                      onClick={() => handleConnectToken(token.id)}
                      disabled={connectingTokens.has(token.id)}
                    >
                      {connectingTokens.has(token.id) ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-400"
                    onClick={() => handleRemoveToken(token.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Usuários Monitorados</h2>
          <p className="text-xs text-muted-foreground">
            Configure os IDs dos usuários que deseja monitorar
          </p>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="ID do usuário (ex: 123456789012345678)"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
            className="flex-1 font-mono text-xs"
          />
          <Button onClick={handleAddUser} disabled={addingUser || !newUserId.trim()} size="sm">
            {addingUser ? <Loader2 size={14} className="animate-spin mr-1" /> : <UserPlus size={14} className="mr-1" />}
            Monitorar
          </Button>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
            <Users size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum usuário monitorado</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Adicione IDs de usuários para começar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback>{user.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                  </Avatar>
                  {user.isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {user.globalName || user.username}
                    </span>
                    {user.globalName && user.username !== user.globalName && (
                      <span className="text-xs text-muted-foreground">@{user.username}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{user.userId}</span>
                    {user.currentVoiceChannel && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Radio size={10} className="animate-pulse" />
                        {user.currentVoiceChannel.channelName} • {user.currentVoiceChannel.guildName}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-400"
                  onClick={() => handleRemoveUser(user.id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-300/80">
        <div className="flex gap-2">
          <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium text-blue-300">Como funciona o monitoramento</p>
            <ul className="list-disc list-inside text-xs space-y-0.5 text-blue-300/60">
              <li>As tokens de monitoramento se conectam separadamente do painel principal</li>
              <li>Quanto mais servidores a token tiver, mais usuários poderão ser monitorados</li>
              <li>A mesma token ativa no painel não pode ser usada aqui</li>
              <li>Todos os eventos são salvos em logs persistentes no AppData</li>
              <li>Vá para o <span className="text-blue-300">Dashboard de Monitoramento</span> para ver eventos em tempo real</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
