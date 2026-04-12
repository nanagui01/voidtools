
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Package,
  Loader2,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
  Timer,
  MessageSquare,
  Ban,
  Zap,
  Clock,
  Archive,
  HardDrive,
  Upload,
  Users,
  FileArchive,
  Trash2,
  Hash,
  SkipForward,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import { useWSEvent } from "@/hooks/use-websocket"
import { ws } from "@/lib/ws-client"
import { Link } from "react-router-dom"
import type { WSToolProgress, WSToolCompleted, WSToolError } from "@/types/websocket"
import type { AppSettings } from "@/types/api"

type Phase =
  | "idle"
  | "analyzing"
  | "ready"
  | "deleting"
  | "backup"
  | "completed"
  | "error"

interface PackageAnalysis {
  totalUsers: number
  totalChannels: number
  totalDMs: number
  userIds: string[]
  progress: {
    hasProgress: boolean
    idsProcessados: number
    idsRestantes: number
    totalMensagensApagadas: number
  } | null
}

function notify(title: string, body: string) {
  try { window.electronAPI?.notification.show({ title, body }) } catch {}
}

export default function PaginaLimparPackage() {
  const { activeToken } = useTokens()
  const [zipPath, setZipPath] = useState("")
  const [whitelist, setWhitelist] = useState("")
  const [configDelay, setConfigDelay] = useState(700)
  const [fazerBackup, setFazerBackup] = useState(false)
  const [salvarMidiaLocal, setSalvarMidiaLocal] = useState(false)
  const [continuar, setContinuar] = useState(false)

  const [phase, setPhase] = useState<Phase>("idle")
  const [analysis, setAnalysis] = useState<PackageAnalysis | null>(null)
  const [starting, setStarting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const [taskId, setTaskId] = useState<string | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState("")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef<number>(0)
  const notificationsRef = useRef(true)
  const notifiedTaskRef = useRef<string | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ username: string; avatarUrl: string | null } | null>(null)
  const [dmStatus, setDmStatus] = useState<'searching' | 'deleting' | 'no-messages' | null>(null)
  const [dmProgress, setDmProgress] = useState<{ deleted: number; total: number } | null>(null)

  useEffect(() => { taskIdRef.current = taskId }, [taskId])

  useEffect(() => {
    api.getSettings().then((res) => {
      const data = res.data as AppSettings
      notificationsRef.current = data?.general?.notifications ?? true
      if (data?.delay) setConfigDelay(data.delay)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.getRunningTasks().then((res) => {
      const tasks = (res.data || []) as Array<{
        id: string
        tool: string
        status: string
        progress: number
        total: number
        phase?: string
        startedAt: string
      }>
      const running = tasks.find((t) => t.tool === 'limpar-package')
      if (running) {
        setTaskId(running.id)
        setProgress(running.progress)
        setTotal(running.total)
        startTimeRef.current = new Date(running.startedAt).getTime()
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
        if (running.phase === 'backup') setPhase('backup')
        else setPhase('deleting')
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (phase !== "deleting" && phase !== "backup") return
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [phase])

  useWSEvent<WSToolProgress>("tool:progress", (data) => {
    if (!taskIdRef.current || data.taskId !== taskIdRef.current) return
    console.log('[LimparPackage] WS progress:', {
      currentUser: data.currentUser,
      dmStatus: data.dmStatus,
      dmProgress: data.dmProgress,
      phase: data.phase,
      progress: data.progress,
      total: data.total,
    })
    setProgress(data.progress)
    setTotal(data.total)
    if (data.message) setStatusMessage(data.message)
    if (data.currentUser) setCurrentUser(data.currentUser)
    if (data.dmStatus) setDmStatus(data.dmStatus)
    if (data.dmProgress) setDmProgress(data.dmProgress)
    else if (data.dmStatus === 'searching' || data.dmStatus === 'no-messages') setDmProgress(null)
    if (data.phase === "fetching" || data.phase === "deleting") setPhase("deleting")
    else if (data.phase === "backup" || data.phase === "backup-media" || data.phase === "backup-saving") setPhase("backup")
    else if (data.phase === "completed") setPhase("completed")
  })

  useWSEvent<WSToolCompleted>("tool:completed", (data) => {
    if (!taskIdRef.current || data.taskId !== taskIdRef.current) return
    setPhase("completed")
    if (notificationsRef.current && notifiedTaskRef.current !== taskIdRef.current) {
      notifiedTaskRef.current = taskIdRef.current
      notify("BrunnoClear", `Package limpo! ${progress} usuários processados`)
    }
  })

  useWSEvent<WSToolError>("tool:error", (data) => {
    if (!taskIdRef.current || data.taskId !== taskIdRef.current) return
    setPhase("error")
    setError(data.error || "Erro desconhecido")
    if (notificationsRef.current && notifiedTaskRef.current !== taskIdRef.current) {
      notifiedTaskRef.current = taskIdRef.current
      notify("BrunnoClear", `Erro no package: ${data.error || "Erro desconhecido"}`)
    }
  })

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.endsWith(".zip")) {
        const filePath = window.electronAPI?.webUtils.getPathForFile(file)
        if (filePath) {
          setZipPath(filePath)
          setAnalysis(null)
          setPhase("idle")
        }
      }
    }
  }, [])

  const handleFileSelect = useCallback(async () => {
    const filePath = await window.electronAPI?.dialog.openFile([
      { name: "ZIP files", extensions: ["zip"] },
    ])
    if (filePath) {
      setZipPath(filePath)
      setAnalysis(null)
      setPhase("idle")
    }
  }, [])

  const handleAnalyze = async () => {
    if (!activeToken || !zipPath.trim()) return
    setAnalyzing(true)
    setError("")
    setPhase("analyzing")

    try {
      const whitelistArray = whitelist
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)

      const res = await api.post<PackageAnalysis>("/tools/limpar-package/analisar", {
        tokenId: activeToken.id,
        zipPath: zipPath.trim(),
        whitelist: whitelistArray,
      })

      const data = res.data as PackageAnalysis
      setAnalysis(data)
      setPhase("ready")

      if (data.progress?.hasProgress) {
        setContinuar(true)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao analisar package")
      setPhase("error")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleStart = async () => {
    if (!activeToken || !zipPath.trim()) return
    setStarting(true)
    setError("")

    try {
      const whitelistArray = whitelist
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)

      const res = await api.runTool("limpar-package", {
        tokenId: activeToken.id,
        zipPath: zipPath.trim(),
        whitelist: whitelistArray,
        delay: configDelay,
        fazerBackup,
        salvarMidiaLocal,
        continuar,
      })

      const data = res.data as {
        taskId: string
        totalUsers: number
        resumed: boolean
      }

      setTaskId(data.taskId)
      setTotal(data.totalUsers)
      setProgress(0)
      setPhase("deleting")
      setDmStatus(null)
      setDmProgress(null)
      setCurrentUser(null)
      notifiedTaskRef.current = null
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)

      if (notificationsRef.current) {
        notify("BrunnoClear", `Limpeza de package iniciada (${data.totalUsers} usuários)`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao iniciar")
      setPhase("error")
    } finally {
      setStarting(false)
    }
  }

  const handleCancel = () => { if (taskId) ws.cancelTask(taskId) }

  const handleReset = () => {
    setTaskId(null)
    setPhase("idle")
    setProgress(0)
    setTotal(0)
    setError("")
    setStatusMessage("")
    setElapsedSeconds(0)
    setAnalysis(null)
    setCurrentUser(null)
    setDmStatus(null)
    setDmProgress(null)
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}s`
  }

  const pct = total > 0 ? Math.round((progress / total) * 100) : 0
  const dmPct = dmProgress && dmProgress.total > 0 ? Math.round((dmProgress.deleted / dmProgress.total) * 100) : 0

  if (phase === "idle" || phase === "analyzing" || phase === "ready") {
    return (
      <div className="space-y-6">
        {!activeToken && (
          <div className="flex items-center gap-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-5 py-4">
            <AlertTriangle size={18} className="shrink-0 text-yellow-500" />
            <span className="text-sm text-yellow-400">Conecte uma conta primeiro para usar esta ferramenta</span>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Package size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Limpar Package</h2>
              <p className="text-xs text-muted-foreground">Apague mensagens de todas as DMs usando seu pacote de dados do Discord</p>
            </div>
          </div>

          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : zipPath
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-secondary/10 hover:border-border/80 cursor-pointer"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={zipPath ? undefined : handleFileSelect}
            role={zipPath ? undefined : "button"}
          >
            {zipPath ? (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileArchive size={24} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{zipPath.split(/[/\\]/).pop()}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-md">{zipPath}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); setZipPath(""); setAnalysis(null); setPhase("idle") }}
                  className="relative z-10 ml-2 h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-red-400"
                >
                  <X size={14} />
                </Button>
              </div>
            ) : (
              <>
                <Upload size={32} className="mb-3 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Arraste o arquivo ZIP aqui</p>
                <p className="mt-1 text-xs text-muted-foreground">ou clique para selecionar</p>
              </>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-border/50 bg-secondary/10 p-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Como obter:</span> Discord → Configurações → Dados e privacidade → Solicitar dados → Marque &quot;Mensagens&quot; e aguarde o ZIP chegar no e-mail
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                IDs para ignorar (whitelist)
              </label>
              <Input
                placeholder="123456789, 987654321 (separados por vírgula)"
                value={whitelist}
                onChange={(e) => setWhitelist(e.target.value)}
                className="h-11 border-border bg-secondary/40 font-mono text-sm"
                disabled={!activeToken}
              />
              <p className="text-[11px] text-muted-foreground">Deixe vazio para processar todas as DMs</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Delay (ms)
              </label>
              <div className="flex h-11 items-center rounded-md border border-border bg-secondary/20 px-4 text-sm tabular-nums text-foreground">
                {configDelay}ms
              </div>
              <Link
                to="/configuracoes"
                className="inline-block text-[11px] text-muted-foreground hover:text-primary transition-colors"
              >
                Alterar nas configurações →
              </Link>
            </div>
          </div>

          <div className="mt-6 space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Archive size={16} className="text-primary/70" />
                <div>
                  <span className="text-sm font-medium text-foreground">Fazer backup antes de apagar</span>
                  <p className="text-xs text-muted-foreground">Salva todas as mensagens de cada DM antes de apagar</p>
                </div>
              </div>
              <Switch checked={fazerBackup} onCheckedChange={setFazerBackup} />
            </div>

            {fazerBackup && (
              <div className="ml-7 flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="flex items-center gap-3">
                  <HardDrive size={14} className="text-primary/70" />
                  <div>
                    <span className="text-sm font-medium text-foreground">Salvar mídia localmente</span>
                    <p className="text-xs text-muted-foreground">
                      Baixa imagens, vídeos e arquivos para o disco
                    </p>
                  </div>
                </div>
                <Switch checked={salvarMidiaLocal} onCheckedChange={setSalvarMidiaLocal} />
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button
              onClick={handleAnalyze}
              disabled={analyzing || !activeToken || !zipPath.trim()}
              className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {analyzing ? (
                <Loader2 size={18} className="mr-2 animate-spin" />
              ) : (
                <Search size={18} className="mr-2" />
              )}
              {analyzing ? "Analisando..." : "Analisar Package"}
            </Button>
          </div>
        </div>

        {error && phase !== "ready" && (
          <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4">
            <X size={16} className="shrink-0 text-red-400" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        {analysis && phase === "ready" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Users size={12} />
                  Usuários encontrados
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-primary">
                  {analysis.totalUsers}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Hash size={12} />
                  Canais analisados
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                  {analysis.totalChannels}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card/40 p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <MessageSquare size={12} />
                  DMs encontradas
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                  {analysis.totalDMs}
                </div>
              </div>
            </div>

            {analysis.progress && (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <SkipForward size={18} className="text-yellow-500" />
                  <h3 className="text-sm font-semibold text-foreground">Progresso anterior encontrado</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Já processados:</span>{" "}
                    <span className="font-medium text-foreground">{analysis.progress.idsProcessados} usuários</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Restantes:</span>{" "}
                    <span className="font-medium text-foreground">{analysis.progress.idsRestantes} usuários</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Msgs apagadas:</span>{" "}
                    <span className="font-medium text-primary">{analysis.progress.totalMensagensApagadas}</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <div className="flex items-center gap-3">
                    <SkipForward size={14} className="text-yellow-500" />
                    <div>
                      <span className="text-sm font-medium text-foreground">Continuar de onde parou</span>
                      <p className="text-xs text-muted-foreground">Pula os usuários já processados</p>
                    </div>
                  </div>
                  <Switch checked={continuar} onCheckedChange={setContinuar} />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card/40 p-4">
              <Button
                onClick={handleStart}
                disabled={starting || !activeToken || analysis.totalUsers === 0}
                className="h-11 w-full bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                {starting ? (
                  <Loader2 size={18} className="mr-2 animate-spin" />
                ) : (
                  <Play size={18} className="mr-2" />
                )}
                {starting
                  ? "Iniciando..."
                  : continuar && analysis.progress
                    ? `Continuar (${analysis.progress.idsRestantes} restantes)`
                    : `Iniciar Limpeza (${analysis.totalUsers} usuários)`
                }
              </Button>
            </div>
          </div>
        )}

        {!analysis && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <FileArchive size={16} className="text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground">Pacote de dados</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Usa o ZIP do Discord para encontrar todas as DMs automaticamente
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Zap size={16} className="text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground">Múltiplos idiomas</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Suporta packages em português e inglês automaticamente
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Timer size={16} className="text-primary" />
              </div>
              <h3 className="text-sm font-medium text-foreground">Progresso salvo</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Se interromper, pode continuar de onde parou na próxima vez
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === "backup") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card/40 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-yellow-500/30 bg-yellow-500/10">
                <Archive size={24} className="text-yellow-400" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 animate-pulse rounded-full border-2 border-card bg-yellow-500" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-foreground">Criando backups...</h2>
              <p className="text-sm text-muted-foreground">{statusMessage || "Preparando backup..."}</p>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Fase</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-yellow-400">
                <Archive size={14} />
                Backup
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          {total > 0 ? (
            <div className="h-1.5 bg-secondary">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          ) : (
            <div className="h-1 animate-pulse bg-gradient-to-r from-transparent via-yellow-500 to-transparent" />
          )}
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Users size={12} />
                  Progresso
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-yellow-400">
                  {progress}<span className="text-base text-muted-foreground">/{total}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Clock size={12} />
                  Tempo
                </div>
                <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{fmt(elapsedSeconds)}</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Archive size={12} />
                  Status
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                  </span>
                  <span className="text-sm font-medium text-foreground truncate">Backup</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {currentUser && (
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-3">
              {currentUser.avatarUrl ? (
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  className="h-10 w-10 rounded-full border-2 border-border object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
                />
              ) : null}
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-secondary/40 text-sm font-bold text-muted-foreground ${currentUser.avatarUrl ? 'hidden' : ''}`}>
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Backup</div>
                <p className="truncate text-sm font-semibold text-foreground">{currentUser.username}</p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card/40 p-4">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="w-full border-border text-muted-foreground hover:border-red-500/30 hover:text-red-400"
          >
            <Ban size={16} className="mr-2" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "deleting") {
    const remaining = total - progress
    const speed = elapsedSeconds > 0 ? (progress / elapsedSeconds).toFixed(1) : "0"

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-card bg-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-foreground">Limpando Package</h2>
              <p className="text-xs text-muted-foreground truncate">{statusMessage || "Iniciando..."}</p>
            </div>
            <div className="text-3xl font-bold tabular-nums text-foreground">{pct}%</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
          <div className="h-1.5 bg-secondary">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="px-5 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{progress}</span> de {total} usuários
              </span>
              <span className="tabular-nums text-muted-foreground">{fmt(elapsedSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-5">
          <div className="flex items-center gap-4">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt={currentUser.username}
                className="h-11 w-11 shrink-0 rounded-full border-2 border-border object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden') }}
              />
            ) : null}
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-border bg-secondary/40 text-sm font-bold text-muted-foreground ${currentUser?.avatarUrl ? 'hidden' : ''}`}>
              {currentUser ? currentUser.username.charAt(0).toUpperCase() : "?"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="truncate text-sm font-semibold text-foreground">
                  {currentUser?.username || "Aguardando..."}
                </p>
                <span className="ml-2 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {progress + 1}/{total}
                </span>
              </div>

              {dmStatus === 'searching' ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-blue-400">Buscando msgs...</span>
                </div>
              ) : dmStatus === 'deleting' && dmProgress ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-200 ease-out"
                      style={{ width: `${dmPct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums font-medium text-red-400">
                    {dmProgress.deleted}/{dmProgress.total} msgs
                  </span>
                </div>
              ) : dmStatus === 'no-messages' ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-primary/20" />
                  <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Sem mensagens</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-secondary/60" />
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">Preparando...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-4">
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Users size={11} />
              Processados
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-primary">{progress}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <MessageSquare size={11} />
              Restantes
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{remaining}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Zap size={11} />
              Velocidade
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-foreground">
              {speed}<span className="text-xs text-muted-foreground">/s</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
              <Clock size={11} />
              Tempo
            </div>
            <div className="mt-1.5 text-xl font-bold tabular-nums text-foreground">{fmt(elapsedSeconds)}</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4">
          <Button
            onClick={handleCancel}
            variant="outline"
            className="w-full border-border text-muted-foreground hover:border-red-500/30 hover:text-red-400"
          >
            <Ban size={16} className="mr-2" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  if (phase === "completed") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden">
          <div className="h-1 bg-primary" />
          <div className="flex items-center gap-5 p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10">
              <CheckCircle2 size={28} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Package limpo com sucesso!</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Todas as DMs do package foram processadas
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users size={12} />
              Usuários processados
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-primary">{progress}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Clock size={12} />
              Duração total
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{fmt(elapsedSeconds)}</div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Zap size={12} />
              Velocidade média
            </div>
            <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">
              {elapsedSeconds > 0 ? (progress / elapsedSeconds).toFixed(2) : "0"}
              <span className="text-sm text-muted-foreground"> usr/s</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4">
          <Button onClick={handleReset} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
            <RotateCcw size={16} className="mr-2" />
            Nova limpeza
          </Button>
        </div>
      </div>
    )
  }

  const isCancelled = error?.includes("Cancelado")
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
        <div className="h-1 bg-red-500" />
        <div className="flex items-center gap-5 p-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/30 bg-red-500/10">
            {isCancelled ? <Ban size={28} className="text-red-400" /> : <X size={28} className="text-red-400" />}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {isCancelled ? "Limpeza cancelada" : "Erro na limpeza"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </div>

      {progress > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users size={12} />
              Progresso parcial
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">
              {progress}<span className="text-muted-foreground">/{total}</span>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Clock size={12} />
              Tempo decorrido
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{fmt(elapsedSeconds)}</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/40 p-4">
        <Button onClick={handleReset} className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          <RotateCcw size={16} className="mr-2" />
          {isCancelled ? "Voltar" : "Tentar novamente"}
        </Button>
      </div>
    </div>
  )
}
