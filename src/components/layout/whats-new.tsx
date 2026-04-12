import { useState, useEffect, useCallback } from "react"
import { X, Sparkles, Bug, Zap, Wrench, ExternalLink } from "lucide-react"

const GITHUB_OWNER = "brunnoxw"
const GITHUB_REPO = "BrunnoClear-V2"
const STORAGE_KEY = "changelog-versao-vista"

interface ReleaseNote {
  version: string
  title: string
  body: string
  publishedAt: string
  url: string
}

/**
 * Busca as release notes da versão atual via GitHub API (público)
 */
async function fetchReleaseNotes(version: string): Promise<ReleaseNote | null> {
  try {
    const tag = version.startsWith("v") ? version : `v${version}`
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tags/${tag}`,
      { headers: { Accept: "application/vnd.github.v3+json" } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return parseRelease(data)
  } catch {
    return null
  }
}

async function fetchLatestRelease(): Promise<ReleaseNote | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github.v3+json" } }
    )
    if (!res.ok) return null
    const data = await res.json()
    return parseRelease(data)
  } catch {
    return null
  }
}

function parseRelease(data: any): ReleaseNote {
  return {
    version: data.tag_name?.replace(/^v/, "") ?? "?",
    title: data.name ?? `Versão ${data.tag_name ?? "?"}`,
    body: data.body ?? "",
    publishedAt: data.published_at ?? "",
    url: data.html_url ?? "",
  }
}

// ── Parser de Markdown estruturado ──

type SectionType = "new" | "fix" | "improvement" | "other"

interface ChangeSection {
  type: SectionType
  items: string[]
}

const sectionConfig: Record<SectionType, { icon: typeof Sparkles; label: string; color: string; bg: string; badge: string }> = {
  new:         { icon: Sparkles, label: "Novidades",  color: "text-emerald-400", bg: "bg-emerald-500/15 ring-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-400" },
  fix:         { icon: Bug,      label: "Correções",  color: "text-amber-400",   bg: "bg-amber-500/15 ring-amber-500/30",   badge: "bg-amber-500/20 text-amber-400" },
  improvement: { icon: Zap,      label: "Melhorias",  color: "text-blue-400",    bg: "bg-blue-500/15 ring-blue-500/30",     badge: "bg-blue-500/20 text-blue-400" },
  other:       { icon: Wrench,   label: "Outros",     color: "text-zinc-400",    bg: "bg-zinc-500/15 ring-zinc-500/30",     badge: "bg-zinc-500/20 text-zinc-400" },
}

function detectSectionType(heading: string): SectionType {
  const h = heading.toLowerCase()
  if (/novidade|new|feat|✨/.test(h)) return "new"
  if (/corre[çc]|fix|bug|🐛/.test(h)) return "fix"
  if (/melhori|improv|otimiz|perf|⚡/.test(h)) return "improvement"
  return "other"
}

function categorizeLineAuto(line: string): SectionType {
  const l = line.toLowerCase()
  if (/\bnov[oa]\b|feat|adicion|criado|implementa|novo /i.test(l)) return "new"
  if (/\bfix\b|corrig|bug|resolv|ajust/i.test(l)) return "fix"
  if (/\bmelhori|improv|otimiz|refator|atualiz|performance/i.test(l)) return "improvement"
  return "other"
}

function parseBody(body: string): ChangeSection[] {
  const lines = body.split("\n")
  const sections: ChangeSection[] = []
  let currentType: SectionType | null = null

  const isNoise = (l: string) =>
    /^\*?\*?full changelog\*?\*?/i.test(l.trim()) ||
    /^https?:\/\/github\.com\/.+\/compare\//i.test(l.trim()) ||
    /^## what's changed/i.test(l.trim()) ||
    /^## new contributors/i.test(l.trim()) ||
    /^\* .+ made their first contribution/i.test(l.trim())

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || isNoise(line)) continue

    const headingMatch = line.match(/^#{1,3}\s+(.+)/)
    if (headingMatch) {
      currentType = detectSectionType(headingMatch[1])
      if (!sections.find((s) => s.type === currentType)) {
        sections.push({ type: currentType, items: [] })
      }
      continue
    }

    const itemMatch = line.match(/^[-*•]\s+(.+)/)
    if (itemMatch) {
      const text = itemMatch[1]
        .replace(/\*\*/g, "") 
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/ by @\S+ in .+$/i, "")
        .trim()

      if (!text) continue

      if (currentType) {
        const section = sections.find((s) => s.type === currentType)
        section?.items.push(text)
      } else {
        const autoType = categorizeLineAuto(text)
        let section = sections.find((s) => s.type === autoType)
        if (!section) {
          section = { type: autoType, items: [] }
          sections.push(section)
        }
        section.items.push(text)
      }
      continue
    }

    if (line.length > 5 && !line.startsWith("#")) {
      const cleaned = line
        .replace(/\*\*/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim()
      if (cleaned && !isNoise(cleaned)) {
        const autoType = currentType ?? categorizeLineAuto(cleaned)
        let section = sections.find((s) => s.type === autoType)
        if (!section) {
          section = { type: autoType, items: [] }
          sections.push(section)
        }
        section.items.push(cleaned)
      }
    }
  }

  const order: SectionType[] = ["new", "fix", "improvement", "other"]
  sections.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))

  return sections.filter((s) => s.items.length > 0)
}

// ── Componente ──

export function WhatsNew() {
  const [release, setRelease] = useState<ReleaseNote | null>(null)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const electronAPI = window.electronAPI
      let version: string | null = null
      let notes: ReleaseNote | null = null

      console.log('[WhatsNew] Iniciando check...', { hasElectronAPI: !!electronAPI, hasGetReleaseNotes: !!electronAPI?.updater?.getReleaseNotes })

      if (electronAPI?.updater?.getReleaseNotes) {
        try {
          version = (await electronAPI.app.getVersion()) ?? null
        } catch {}
        console.log('[WhatsNew] Versão Electron:', version)
        if (!version || cancelled) return

        const lastSeen = localStorage.getItem(STORAGE_KEY)
        console.log('[WhatsNew] Última versão vista:', lastSeen)
        if (lastSeen === version) {
          console.log('[WhatsNew] Já viu esta versão, saindo.')
          return
        }

        console.log('[WhatsNew] Buscando release notes via IPC...')
        const data = await electronAPI.updater.getReleaseNotes(version)
        console.log('[WhatsNew] Resposta IPC:', JSON.stringify(data, null, 2))
        if (data && data.body) {
          notes = {
            version: data.version?.replace(/^v/, "") ?? version,
            title: data.name ?? `Versão ${version}`,
            body: data.body,
            publishedAt: data.published_at ?? "",
            url: data.html_url ?? "",
          }
        } else {
          console.log('[WhatsNew] IPC retornou body vazio/null. Tentando fetch direto da latest...')
          // Fallback direto no renderer — tenta buscar qualquer release com body
          try {
            const latestRes = await fetch(
              `https://api.github.com/repos/brunnoxw/BrunnoClear-V2/releases`,
              { headers: { Accept: "application/vnd.github.v3+json" } }
            )
            if (latestRes.ok) {
              const releases: any[] = await latestRes.json()
              const withBody = releases.find((r: any) => r.body && r.body.trim().length > 0)
              if (withBody) {
                console.log('[WhatsNew] Encontrada release com body:', withBody.tag_name)
                notes = parseRelease(withBody)
                // Usa a versão do app, não da release encontrada, pra marcar como vista corretamente
                notes.version = version
              }
            }
          } catch (e) {
            console.log('[WhatsNew] Fallback fetch falhou:', e)
          }
        }
      } else {
        console.log('[WhatsNew] Sem Electron, tentando fetch público...')
        notes = await fetchLatestRelease()
        console.log('[WhatsNew] Resultado fetch público:', notes)
        if (notes) version = notes.version
        if (!version || cancelled) return

        const lastSeen = localStorage.getItem(STORAGE_KEY)
        if (lastSeen === version) return
      }
      if (cancelled) return

      if (notes && notes.body.trim().length > 0) {
        const sections = parseBody(notes.body)
        if (sections.length > 0) {
          console.log('[WhatsNew] Exibindo changelog!', notes.title, sections)
          setRelease(notes)
          setVisible(true)
        } else {
          console.log('[WhatsNew] Body existente mas sem itens parseáveis.')
        }
      } else {
        console.log('[WhatsNew] Nenhuma release note encontrada, tentará novamente depois.')
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  const dismiss = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setVisible(false)
      setClosing(false)
      if (release) {
        localStorage.setItem(STORAGE_KEY, release.version)
      }
    }, 300)
  }, [release])

  if (!visible || !release) return null

  const sections = parseBody(release.body)
  const formattedDate = release.publishedAt
    ? new Date(release.publishedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : null
  const totalChanges = sections.reduce((sum, s) => sum + s.items.length, 0)

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-all duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      {/* Card */}
      <div
        className={`relative z-10 mx-4 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c10]/95 shadow-2xl shadow-black/60 transition-all duration-300 ${
          closing ? "translate-y-4 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        {/* ── Header ── */}
        <div className="relative overflow-hidden px-7 pb-5 pt-7">
          {/* Glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background: "radial-gradient(ellipse at 50% -20%, var(--cor-painel, #6366f1) 0%, transparent 70%)",
            }}
          />

          <button
            onClick={dismiss}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-white/30 transition-colors hover:bg-white/10 hover:text-white/70"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="relative">
            <div className="mb-3 flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl ring-1 ring-white/10"
                style={{ background: "linear-gradient(135deg, var(--cor-painel, #6366f1), color-mix(in srgb, var(--cor-painel, #6366f1), black 40%))" }}
              >
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">
                O que há de novo
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-white">
              {release.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/35">
              <span className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-white/50">
                v{release.version}
              </span>
              {formattedDate && (
                <span className="flex items-center gap-1">
                  <span className="text-white/20">•</span> {formattedDate}
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="text-white/20">•</span> {totalChanges} alteraç{totalChanges === 1 ? "ão" : "ões"}
              </span>
            </div>
          </div>
        </div>

        {/* ── Seções ── */}
        <div className="flex-1 overflow-y-auto px-7 pb-3">
          <div className="space-y-5">
            {sections.map((section) => {
              const config = sectionConfig[section.type]
              const Icon = config.icon
              return (
                <div key={section.type}>
                  {/* Heading da seção */}
                  <div className="mb-2.5 flex items-center gap-2">
                    <div className={`flex h-5 w-5 items-center justify-center rounded-md ring-1 ${config.bg}`}>
                      <Icon className={`h-2.5 w-2.5 ${config.color}`} />
                    </div>
                    <span className={`text-xs font-semibold uppercase tracking-wider ${config.color}`}>
                      {config.label}
                    </span>
                    <span className={`rounded-full px-1.5 py-px text-[10px] font-medium ${config.badge}`}>
                      {section.items.length}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="space-y-1">
                    {section.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-white/[0.04]"
                      >
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${config.color} opacity-60`} />
                        <span className="text-[13px] leading-relaxed text-white/75">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-white/[0.06] px-7 py-4">
          <button
            onClick={() => window.electronAPI?.shell.openExternal(release.url)}
            className="flex items-center gap-1.5 text-xs text-white/25 transition-colors hover:text-white/50"
          >
            <ExternalLink className="h-3 w-3" />
            Ver no GitHub
          </button>

          <button
            onClick={dismiss}
            className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: "linear-gradient(135deg, var(--cor-painel, #6366f1), color-mix(in srgb, var(--cor-painel, #6366f1), black 25%))",
              boxShadow: "0 4px 20px -4px color-mix(in srgb, var(--cor-painel, #6366f1), transparent 60%)",
            }}
          >
            Entendi!
          </button>
        </div>
      </div>
    </div>
  )
}
