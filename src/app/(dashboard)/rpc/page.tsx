
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Gamepad2,
  Save,
  Loader2,
  RefreshCw,
  PowerOff,
  Plus,
  Trash2,
  Search,
  ExternalLink,
  Type,
  Image as ImageIcon,
  Link2,
  Eye,
  Zap,
  Info,
} from "lucide-react"
import { api } from "@/lib/api-client"

const DEFAULT_IMAGE = "https://i.imgur.com/piwT2gz.jpeg"
const APP_VERSION = import.meta.env.VITE_APP_VERSION || "1.0.0"

function resolverPlaceholders(texto: string): string {
  return texto.replace(/\{\{versao\}\}/gi, APP_VERSION)
}

interface RpcConfig {
  applicationId: string
  detalhes: string
  estado: string
  nome: string
  imagemUrl: string
  botoes: Array<{ label: string; url: string }>
  desativado: boolean
}

interface RpcStatus {
  active: boolean
  startedAt: string | null
  config: RpcConfig
}

interface AppInfo {
  name: string
  icon: string | null
}

const RPC_DEFAULTS: RpcConfig = {
  applicationId: "1486120560617324644",
  detalhes: ">.<",
  estado: "",
  nome: "BrunnoClear",
  imagemUrl: "https://i.imgur.com/piwT2gz.jpeg",
  botoes: [],
  desativado: false,
}

export default function PaginaRPC() {
  const [status, setStatus] = useState<RpcStatus | null>(null)
  const [config, setConfig] = useState<RpcConfig>(RPC_DEFAULTS)
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [buscandoApp, setBuscandoApp] = useState(false)
  const [elapsed, setElapsed] = useState("00:00")
  const elapsedRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.getRpcStatus()
      const data = res.data as RpcStatus
      setStatus(data)
      const merged = { ...RPC_DEFAULTS } as RpcConfig
      const c = data.config
      if (c.applicationId) merged.applicationId = c.applicationId
      if (c.detalhes) merged.detalhes = c.detalhes
      if (c.estado) merged.estado = c.estado
      if (c.nome) merged.nome = c.nome
      if (c.imagemUrl) merged.imagemUrl = c.imagemUrl
      if (c.botoes?.length) merged.botoes = c.botoes
      merged.desativado = !!c.desativado
      setConfig(merged)
      if (data.config.applicationId && /^\d{17,20}$/.test(data.config.applicationId)) {
        try {
          const appRes = await api.getRpcAppInfo(data.config.applicationId)
          const info = appRes.data as AppInfo
          setAppInfo(info)
        } catch {}
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchStatus().finally(() => setCarregando(false))
  }, [fetchStatus])

  useEffect(() => {
    if (elapsedRef.current) clearInterval(elapsedRef.current)
    elapsedRef.current = setInterval(() => {
      if (status?.startedAt) {
        setElapsed(formatElapsed(new Date(status.startedAt)))
      } else {
        setElapsed((prev) => {
          const [m, s] = prev.split(":").map(Number)
          const total = m * 60 + s + 1
          return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`
        })
      }
    }, 1000)
    return () => clearInterval(elapsedRef.current)
  }, [status?.startedAt])

  const buscarAppInfo = async (id?: string) => {
    const appId = id || config.applicationId
    if (!appId || !/^\d{17,20}$/.test(appId)) return
    setBuscandoApp(true)
    try {
      const res = await api.getRpcAppInfo(appId)
      const data = res.data as AppInfo
      setAppInfo(data)
      if (data.name && data.name !== "Unknown") {
        setConfig((c) => ({ ...c, nome: data.name }))
      }
    } catch {} finally {
      setBuscandoApp(false)
    }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      await api.toggleRpc()
      await fetchStatus()
    } catch {} finally {
      setToggling(false)
    }
  }

  const handleSave = async () => {
    setSalvando(true)
    try {
      const { desativado, ...configToSave } = config
      await api.updateRpcConfig(configToSave)
      await fetchStatus()
    } catch {} finally {
      setSalvando(false)
    }
  }

  const handleRestart = async () => {
    setToggling(true)
    try {
      await api.restartRpc()
      await fetchStatus()
    } catch {} finally {
      setToggling(false)
    }
  }

  const addBotao = () => {
    if (config.botoes.length >= 2) return
    setConfig((c) => ({ ...c, botoes: [...c.botoes, { label: "", url: "" }] }))
  }

  const removeBotao = (i: number) => {
    setConfig((c) => ({ ...c, botoes: c.botoes.filter((_, idx) => idx !== i) }))
  }

  const updateBotao = (i: number, field: "label" | "url", value: string) => {
    setConfig((c) => ({
      ...c,
      botoes: c.botoes.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)),
    }))
  }

  const isActive = status?.active ?? false
  const previewImage = config.imagemUrl || appInfo?.icon || DEFAULT_IMAGE
  const previewDetalhes = resolverPlaceholders(config.detalhes)
  const previewEstado = resolverPlaceholders(config.estado)

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rich Presence</h1>
          <p className="text-sm text-muted-foreground">Configure o Discord Rich Presence do BrunnoClear</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            disabled={toggling || config.desativado}
            className="gap-1.5"
          >
            <RefreshCw size={14} className={toggling ? "animate-spin" : ""} />
            Reiniciar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={salvando}
            className="gap-1.5"
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr,340px] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  isActive ? "bg-primary/10" : "bg-red-500/10"
                }`}>
                  {isActive
                    ? <Zap size={18} className="text-primary" />
                    : <PowerOff size={18} className="text-red-400" />
                  }
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {isActive ? "Presence Ativo" : "Presence Desativado"}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {isActive && status?.startedAt
                      ? `Desde ${new Date(status.startedAt).toLocaleTimeString("pt-BR")}`
                      : "Ative para aparecer no Discord"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggle}
                disabled={toggling}
                className={`relative h-6 w-11 rounded-full transition-colors ${
                  isActive ? "bg-primary" : "bg-secondary"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform ${
                    isActive ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Gamepad2 size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Aplicação Discord</h2>
                <p className="text-xs text-muted-foreground">
                  Crie em{" "}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary/80 hover:text-primary hover:underline inline-flex items-center gap-0.5 transition-colors"
                    onClick={(e) => {
                      e.preventDefault()
                      window.electronAPI?.shell?.openPath("https://discord.com/developers/applications")
                    }}
                  >
                    Developer Portal <ExternalLink size={10} />
                  </a>
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="ID da Aplicação (ex: 1486120560617324644)"
                  value={config.applicationId}
                  onChange={(e) => setConfig((c) => ({ ...c, applicationId: e.target.value }))}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => buscarAppInfo()}
                  disabled={buscandoApp || !config.applicationId}
                  className="shrink-0"
                >
                  {buscandoApp ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </Button>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome da Aplicação</label>
                <Input
                  value={appInfo?.name || config.nome || ""}
                  disabled
                  className="text-sm bg-secondary/20 text-muted-foreground cursor-not-allowed"
                />
                <p className="mt-1 text-[11px] text-muted-foreground/60">Definido pela aplicação Discord — altere o ID para mudar</p>
              </div>
            </div>

            {appInfo?.icon && (
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-secondary/30 p-3">
                <img src={appInfo.icon} alt={appInfo.name} className="h-10 w-10 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{appInfo.name}</p>
                  <p className="truncate text-xs text-muted-foreground font-mono">{config.applicationId}</p>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Type size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Conteúdo</h2>
                <p className="text-xs text-muted-foreground">Textos exibidos no Rich Presence</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Detalhes (linha 1)</label>
                <Input
                  placeholder="ex: >.<"
                  value={config.detalhes}
                  onChange={(e) => setConfig((c) => ({ ...c, detalhes: e.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado (linha 2)</label>
                <Input
                  placeholder={`ex: /v${APP_VERSION}`}
                  value={config.estado}
                  onChange={(e) => setConfig((c) => ({ ...c, estado: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-lg bg-secondary/20 p-3">
              <Info size={14} className="mt-0.5 shrink-0 text-primary/60" />
              <div className="text-xs text-muted-foreground">
                <p>Use <code className="rounded bg-secondary/60 px-1 py-0.5 font-mono text-foreground/80">{"{{versao}}"}</code> nos campos para inserir a versão atual automaticamente.</p>
                <p className="mt-1 text-muted-foreground/60">Exemplo: <code className="font-mono">/v{"{{versao}}"}</code> → <code className="font-mono">/v{APP_VERSION}</code></p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ImageIcon size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Imagem Grande</h2>
                <p className="text-xs text-muted-foreground">URL de imagem ou deixe vazio para usar o ícone da app</p>
              </div>
            </div>

            <Input
              placeholder="https://exemplo.com/imagem.png"
              value={config.imagemUrl}
              onChange={(e) => setConfig((c) => ({ ...c, imagemUrl: e.target.value }))}
            />

            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-secondary">
                <img
                  src={previewImage}
                  alt="Preview"
                  className="h-full w-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {config.imagemUrl ? "Imagem personalizada" : appInfo?.icon ? "Ícone da aplicação" : "Imagem padrão"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Link2 size={18} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Botões</h2>
                  <p className="text-xs text-muted-foreground">Até 2 botões clicáveis no perfil</p>
                </div>
              </div>
              {config.botoes.length < 2 && (
                <Button variant="outline" size="sm" onClick={addBotao} className="gap-1.5">
                  <Plus size={14} />
                  Adicionar
                </Button>
              )}
            </div>

            {config.botoes.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-6">
                <Link2 size={20} className="mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground/60">Nenhum botão configurado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {config.botoes.map((botao, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-secondary/20 p-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Texto do botão"
                        value={botao.label}
                        onChange={(e) => updateBotao(i, "label", e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="https://exemplo.com"
                        value={botao.url}
                        onChange={(e) => updateBotao(i, "url", e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBotao(i)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-6 h-fit">
          <div className="overflow-hidden rounded-xl border border-border bg-card/40">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Eye size={14} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Preview ao Vivo</h3>
            </div>

            <div className="p-4">
              <div className="rounded-lg bg-[#111214] p-3.5">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#b5bac1]">Jogando</p>

                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <div className="h-[60px] w-[60px] overflow-hidden rounded-lg bg-[#2b2d31]">
                      <img
                        src={previewImage}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_IMAGE }}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="truncate text-sm font-semibold text-white leading-tight">
                      {appInfo?.name || config.nome || "BrunnoClear"}
                    </p>
                    {previewDetalhes && (
                      <p className="mt-0.5 truncate text-xs text-[#dbdee1]">{previewDetalhes}</p>
                    )}
                    {previewEstado && (
                      <p className="mt-0.5 truncate text-xs text-[#dbdee1]">{previewEstado}</p>
                    )}
                    <p className="mt-0.5 text-xs text-[#a3a6aa]">
                      {elapsed} decorrido
                    </p>
                  </div>
                </div>

                {config.botoes.filter(b => b.label).length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {config.botoes.filter(b => b.label).map((botao, i) => (
                      <div
                        key={i}
                        className="flex h-[30px] items-center justify-center rounded bg-[#4e5058]/50 text-[13px] font-medium text-white"
                      >
                        {botao.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
              <div className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
              <span className="text-xs text-muted-foreground">
                {isActive ? "Conectado ao Discord" : "Desconectado"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatElapsed(start: Date): string {
  const diff = Math.floor((Date.now() - start.getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  if (h > 0) return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}
