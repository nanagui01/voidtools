
import { useEffect, useState, useCallback } from "react"
import {
  User,
  Shield,
  Crown,
  Calendar,
  Clock,
  Hash,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Star,
  CreditCard,
  ChevronRight,
  Zap,
  Eye,
  EyeOff,
  Monitor,
  Globe,
  Smartphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { api } from "@/lib/api-client"
import type { DiscordUser, Badge, CachedProfile } from "@/types/discord"

interface ProfileResponse {
  user: DiscordUser
  avatarUrl: string | null
  badges: Badge[]
  profileData: CachedProfile | null
  tokenId: string
  label: string
  addedAt: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

function formatRelative(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = now - then
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Hoje"
  if (days === 1) return "Ontem"
  if (days < 30) return `${days} dias atrás`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"} atrás`
  const years = Math.floor(months / 12)
  return `${years} ${years === 1 ? "ano" : "anos"} atrás`
}

function formatDuration(startIso: string): string {
  const now = new Date()
  const start = new Date(startIso)
  const diffMs = now.getTime() - start.getTime()
  const days = Math.floor(diffMs / 86400000)
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  const remainDays = days - years * 365 - months * 30
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ano${years > 1 ? "s" : ""}`)
  if (months > 0) parts.push(`${months} mês${months > 1 ? "es" : ""}`)
  if (remainDays > 0 && years === 0) parts.push(`${remainDays} dia${remainDays > 1 ? "s" : ""}`)
  if (parts.length > 1) return parts.slice(0, -1).join(", ") + " e " + parts[parts.length - 1]
  return parts[0] || "Menos de 1 dia"
}

function timeSinceCreation(iso: string): string {
  return formatDuration(iso)
}

function getPremiumLabel(premiumType: number): string | null {
  switch (premiumType) {
    case 1: return "Nitro Classic"
    case 2: return "Nitro"
    case 3: return "Nitro Basic"
    default: return null
  }
}

const NITRO_LEVELS = [
  { days: 30,   name: "Bronze",    img: "https://ik.imagekit.io/xys3wb0qo/badges/bronze.png" },
  { days: 90,   name: "Prata",     img: "https://ik.imagekit.io/xys3wb0qo/badges/silver.png" },
  { days: 180,  name: "Ouro",      img: "https://ik.imagekit.io/xys3wb0qo/badges/gold.png" },
  { days: 365,  name: "Platina",   img: "https://ik.imagekit.io/xys3wb0qo/badges/platinum.png" },
  { days: 730,  name: "Diamante",  img: "https://ik.imagekit.io/xys3wb0qo/badges/diamond.png" },
  { days: 1095, name: "Esmeralda", img: "https://ik.imagekit.io/xys3wb0qo/badges/emerald.png" },
  { days: 1825, name: "Rubi",      img: "https://ik.imagekit.io/xys3wb0qo/badges/ruby.png" },
  { days: 2190, name: "Opala",     img: "https://ik.imagekit.io/xys3wb0qo/badges/opal.png" },
]

function getNitroProgress(premiumSince: string) {
  const totalDays = Math.floor((Date.now() - new Date(premiumSince).getTime()) / 86400000)
  let currentIdx = -1
  let nextIdx = 0
  for (let i = 0; i < NITRO_LEVELS.length; i++) {
    if (totalDays >= NITRO_LEVELS[i].days) {
      currentIdx = i
      if (i + 1 < NITRO_LEVELS.length) nextIdx = i + 1
      else nextIdx = -1
    } else {
      nextIdx = i
      break
    }
  }
  const current = currentIdx >= 0 ? NITRO_LEVELS[currentIdx] : null
  const next = nextIdx >= 0 ? NITRO_LEVELS[nextIdx] : null
  const prevDays = current ? current.days : 0
  const nextDays = next ? next.days : prevDays
  const rangeProgress = next ? ((totalDays - prevDays) / (nextDays - prevDays)) * 100 : 100
  const daysToNext = next ? Math.max(0, nextDays - totalDays) : 0
  const nextDate = next ? new Date(new Date(premiumSince).getTime() + next.days * 86400000) : null
  return { totalDays, current, next, currentIdx, progress: Math.min(100, Math.max(0, rangeProgress)), daysToNext, nextDate }
}

const BOOST_LEVELS: Record<number, string> = {
  1:  "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost1.svg",
  2:  "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost2.svg",
  3:  "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost3.svg",
  6:  "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost4.svg",
  9:  "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost5.svg",
  12: "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost6.svg",
  15: "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost7.svg",
  18: "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost8.svg",
  24: "https://ik.imagekit.io/xys3wb0qo/boosts/discordboost9.svg",
}
const BOOST_THRESHOLDS = [1, 2, 3, 6, 9, 12, 15, 18, 24]

function getBoostProgress(boostSince: string) {
  const now = Date.now()
  const start = new Date(boostSince).getTime()
  const monthsElapsed = (now - start) / (30.44 * 24 * 60 * 60 * 1000)
  let prevMonth = 1
  let nextMonth = 2
  for (const m of BOOST_THRESHOLDS) {
    if (monthsElapsed >= m) prevMonth = m
    else { nextMonth = m; break; }
  }
  if (monthsElapsed >= 24) { prevMonth = 24; nextMonth = -1 }
  const currentImg = BOOST_LEVELS[prevMonth]
  const nextImg = nextMonth > 0 ? BOOST_LEVELS[nextMonth] : null
  const rangeDays = nextMonth > 0 ? (nextMonth - prevMonth) * 30.44 : 1
  const elapsed = monthsElapsed - prevMonth > 0 ? (monthsElapsed - prevMonth) * 30.44 : 0
  const progress = nextMonth > 0 ? Math.min(100, (elapsed / rangeDays) * 100) : 100
  const daysToNext = nextMonth > 0 ? Math.max(0, Math.ceil((nextMonth * 30.44 * 86400000 - (now - start)) / 86400000)) : 0
  const nextDate = nextMonth > 0 ? new Date(start + nextMonth * 30.44 * 86400000) : null
  return { prevMonth, nextMonth, currentImg, nextImg, progress, daysToNext, nextDate, monthsElapsed: Math.floor(monthsElapsed) }
}

function NitroProgress({ premiumSince }: { premiumSince: string }) {
  const { totalDays, current, next, currentIdx, progress, daysToNext, nextDate } = getNitroProgress(premiumSince)
  const isMax = !next

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-0.5">
          <Sparkles size={16} className="text-[#f47fff]" />
          <h3 className="text-sm font-bold text-foreground">Progresso Nitro</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {totalDays} dias de Nitro — {currentIdx + 1} de {NITRO_LEVELS.length} níveis
        </p>
      </div>

      <div className="px-5 flex items-center gap-3 py-3">
        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          {current ? (
            <img src={current.img} alt={current.name} className="h-14 w-14 object-contain" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-secondary/40 flex items-center justify-center">
              <Sparkles size={20} className="text-muted-foreground" />
            </div>
          )}
          <span className="text-[11px] font-semibold text-foreground">{current?.name || "—"}</span>
          <span className="text-[9px] text-muted-foreground">Atual</span>
        </div>

        <div className="flex-1">
          <div className="h-2.5 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #f47fff, #c084fc, #818cf8)",
              }}
            />
          </div>
          {!isMax && (
            <div className="mt-1 text-[10px] text-muted-foreground text-center">
              {daysToNext} dias restantes
            </div>
          )}
          {isMax && (
            <div className="mt-1 text-[10px] text-emerald-400 text-center font-medium">
              Nível máximo atingido!
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          {next ? (
            <img src={next.img} alt={next.name} className="h-14 w-14 object-contain opacity-50" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check size={24} className="text-emerald-400" />
            </div>
          )}
          <span className="text-[11px] font-semibold text-foreground">{next?.name || "Completo"}</span>
          <span className="text-[9px] text-muted-foreground">{next ? "Próximo" : "Max"}</span>
        </div>
      </div>

      {next && nextDate && (
        <div className="px-5 pb-2">
          <div className="text-[10px] text-muted-foreground">
            Próximo nível em {formatDate(nextDate.toISOString())} ({next.days} dias de Nitro)
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-2">
        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
            Todos os Níveis
          </div>
          <div className="flex items-center gap-2">
            {NITRO_LEVELS.map((lvl, i) => {
              const unlocked = totalDays >= lvl.days
              return (
                <Tooltip key={lvl.name}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-0.5">
                      <img
                        src={lvl.img}
                        alt={lvl.name}
                        className="h-8 w-8 object-contain transition-all"
                        style={{ opacity: unlocked ? 1 : 0.25, filter: unlocked ? "none" : "grayscale(1)" }}
                      />
                      {i === currentIdx && (
                        <div className="h-1 w-4 rounded-full bg-[#f47fff]" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {lvl.name} — {lvl.days} dias{unlocked ? " ✓" : ""}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function BoostProgress({ boostSince }: { boostSince: string }) {
  const { prevMonth, nextMonth, currentImg, nextImg, progress, daysToNext, nextDate, monthsElapsed } = getBoostProgress(boostSince)
  const isMax = nextMonth < 0

  return (
    <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-0.5">
          <Zap size={16} className="text-[#ff73fa]" />
          <h3 className="text-sm font-bold text-foreground">Progresso Server Boost</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {monthsElapsed} {monthsElapsed === 1 ? "mês" : "meses"} boostando
        </p>
      </div>

      <div className="px-5 flex items-center gap-3 py-3">
        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          <img src={currentImg} alt={`Boost ${prevMonth}m`} className="h-14 w-14 object-contain" />
          <span className="text-[11px] font-semibold text-foreground">{prevMonth}m</span>
          <span className="text-[9px] text-muted-foreground">Atual</span>
        </div>

        <div className="flex-1">
          <div className="h-2.5 rounded-full bg-secondary/60 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #ff73fa, #a855f7, #6366f1)",
              }}
            />
          </div>
          {!isMax && (
            <div className="mt-1 text-[10px] text-muted-foreground text-center">
              {daysToNext} dias restantes
            </div>
          )}
          {isMax && (
            <div className="mt-1 text-[10px] text-emerald-400 text-center font-medium">
              Nível máximo atingido!
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 min-w-[72px]">
          {nextImg ? (
            <img src={nextImg} alt={`Boost ${nextMonth}m`} className="h-14 w-14 object-contain opacity-50" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check size={24} className="text-emerald-400" />
            </div>
          )}
          <span className="text-[11px] font-semibold text-foreground">{nextMonth > 0 ? `${nextMonth}m` : "Max"}</span>
          <span className="text-[9px] text-muted-foreground">{nextImg ? "Próximo" : "Completo"}</span>
        </div>
      </div>

      {nextDate && nextMonth > 0 && (
        <div className="px-5 pb-2">
          <div className="text-[10px] text-muted-foreground">
            Próximo nível em {formatDate(nextDate.toISOString())} ({nextMonth} meses de boost)
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-2">
        <div className="rounded-xl border border-border bg-secondary/20 p-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">
            Todos os Níveis
          </div>
          <div className="flex items-center gap-2">
            {BOOST_THRESHOLDS.map((m) => {
              const unlocked = monthsElapsed >= m
              const isCurrent = prevMonth === m
              return (
                <Tooltip key={m}>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-0.5">
                      <img
                        src={BOOST_LEVELS[m]}
                        alt={`${m}m`}
                        className="h-8 w-8 object-contain transition-all"
                        style={{ opacity: unlocked ? 1 : 0.25, filter: unlocked ? "none" : "grayscale(1)" }}
                      />
                      {isCurrent && (
                        <div className="h-1 w-4 rounded-full bg-[#ff73fa]" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {m} {m === 1 ? "mês" : "meses"}{unlocked ? " ✓" : ""}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  )
}

function obfuscarEmail(email: string): string {
  const [local, dominio] = email.split("@")
  if (!dominio) return "••••••"
  const visivel = local.slice(0, 2)
  return `${visivel}${"•".repeat(Math.max(local.length - 2, 3))}@${dominio}`
}

function obfuscarTelefone(phone: string): string {
  const digitos = phone.replace(/\D/g, "")
  if (digitos.length <= 4) return "••••"
  return "•".repeat(digitos.length - 4) + digitos.slice(-4)
}

export default function PaginaPerfil() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [mostrarEmail, setMostrarEmail] = useState(false)
  const [mostrarTelefone, setMostrarTelefone] = useState(false)
  const [accountStatus, setAccountStatus] = useState<{ status: string; platform: string }>({ status: 'online', platform: 'desktop' })
  const [changingStatus, setChangingStatus] = useState(false)
  const [changingPlatform, setChangingPlatform] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.getProfile()
      setProfile(res.data as ProfileResponse)
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfil")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  useEffect(() => {
    api.getAccountStatus().then((res) => {
      if (res.data) setAccountStatus({ status: (res.data as any).status, platform: (res.data as any).platform })
    }).catch(() => {})
  }, [])

  const handleStatusChange = async (status: string) => {
    setChangingStatus(true)
    try {
      const res = await api.setAccountStatus({ status })
      if (res.data) setAccountStatus({ status: (res.data as any).status, platform: (res.data as any).platform })
    } catch {}
    setChangingStatus(false)
  }

  const handlePlatformChange = async (platform: string) => {
    setChangingPlatform(true)
    try {
      const res = await api.setAccountStatus({ platform })
      if (res.data) setAccountStatus({ status: (res.data as any).status, platform: (res.data as any).platform })
    } catch {}
    setChangingPlatform(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const res = await api.refreshProfile()
      setProfile(res.data as ProfileResponse)
    } catch {}
    setRefreshing(false)
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <User size={20} className="text-primary" />
          </div>
          <h1 className="text-lg font-bold text-foreground">Perfil</h1>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">{error || "Nenhuma conta selecionada"}</p>
        </div>
      </div>
    )
  }

  const { user, avatarUrl, badges, profileData } = profile
  const displayName = user.global_name || user.username
  const showUsername = user.global_name && user.global_name !== user.username
  const premiumLabel = getPremiumLabel(profileData?.premiumType ?? user.premium_type ?? 0)
  const createdAt = profileData?.createdAt || null
  const premiumSince = profileData?.premiumSince || null
  const boostSince = profileData?.premiumGuildSince || null
  const cachedAt = profileData?.cachedAt || null

  const bannerColor = user.accent_color
    ? `#${user.accent_color.toString(16).padStart(6, "0")}`
    : null

  const avatarSrc = avatarUrl || undefined
  const bannerUrl = user.banner && user.id
    ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${user.banner.startsWith("a_") ? "gif" : "png"}?size=600`
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <User size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Perfil</h1>
            <p className="text-xs text-muted-foreground">Informações da conta selecionada</p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <RefreshCw size={15} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atualizar perfil do Discord</TooltipContent>
        </Tooltip>
      </div>

      <div className="rounded-xl border border-border bg-card/40 overflow-hidden">
        <div
          className="h-32 relative"
          style={{
            background: bannerUrl
              ? `url(${bannerUrl}) center/cover no-repeat`
              : bannerColor
              ? bannerColor
              : "linear-gradient(135deg, hsl(var(--primary)/0.3), hsl(var(--primary)/0.1))",
          }}
        />

        <div className="relative px-6 pb-5">
          <div className="-mt-12 flex items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-card/40 ring-2 ring-border shrink-0">
              <AvatarImage src={avatarSrc} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-bold text-foreground truncate">{displayName}</span>
                {showUsername && (
                  <span className="text-sm text-muted-foreground">@{user.username}</span>
                )}
              </div>
              {badges.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {badges.map((badge) => (
                    <Tooltip key={badge.name}>
                      <TooltipTrigger asChild>
                        <img src={badge.url} alt={badge.tooltip} className="h-5 w-5" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">{badge.tooltip}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-3 pb-1 shrink-0">
              <div className="flex items-center gap-1">
                {([
                  { key: 'online', color: 'bg-green-500', label: 'Online' },
                  { key: 'idle', color: 'bg-yellow-500', label: 'Ausente' },
                  { key: 'dnd', color: 'bg-red-500', label: 'Não Perturbe' },
                  { key: 'invisible', color: 'bg-gray-500', label: 'Invisível' },
                ] as const).map((s) => (
                  <Tooltip key={s.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleStatusChange(s.key)}
                        disabled={changingStatus}
                        className={`relative flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                          accountStatus.status === s.key
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-border bg-secondary/30 hover:bg-secondary/60'
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{s.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

              <div className="w-px h-6 bg-border" />

              <div className="flex items-center gap-1">
                {([
                  { key: 'desktop', icon: Monitor, label: 'Desktop' },
                  { key: 'web', icon: Globe, label: 'Web' },
                  { key: 'mobile', icon: Smartphone, label: 'Mobile' },
                ] as const).map((p) => (
                  <Tooltip key={p.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handlePlatformChange(p.key)}
                        disabled={changingPlatform}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                          accountStatus.platform === p.key
                            ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                            : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        }`}
                      >
                        <p.icon size={13} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{p.label}</TooltipContent>
                  </Tooltip>
                ))}
                {changingPlatform && (
                  <Loader2 size={13} className="animate-spin text-muted-foreground ml-0.5" />
                )}
              </div>
            </div>
          </div>

          <div className="flex sm:hidden items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              {([
                { key: 'online', color: 'bg-green-500', label: 'Online' },
                { key: 'idle', color: 'bg-yellow-500', label: 'Ausente' },
                { key: 'dnd', color: 'bg-red-500', label: 'Não Perturbe' },
                { key: 'invisible', color: 'bg-gray-500', label: 'Invisível' },
              ] as const).map((s) => (
                <Tooltip key={s.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleStatusChange(s.key)}
                      disabled={changingStatus}
                      className={`relative flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                        accountStatus.status === s.key
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border bg-secondary/30 hover:bg-secondary/60'
                      }`}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{s.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-1">
              {([
                { key: 'desktop', icon: Monitor, label: 'Desktop' },
                { key: 'web', icon: Globe, label: 'Web' },
                { key: 'mobile', icon: Smartphone, label: 'Mobile' },
              ] as const).map((p) => (
                <Tooltip key={p.key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handlePlatformChange(p.key)}
                      disabled={changingPlatform}
                      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                        accountStatus.platform === p.key
                          ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      }`}
                    >
                      <p.icon size={13} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{p.label}</TooltipContent>
                </Tooltip>
              ))}
              {changingPlatform && (
                <Loader2 size={13} className="animate-spin text-muted-foreground ml-0.5" />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          {premiumSince && premiumLabel && (
            <NitroProgress premiumSince={premiumSince} />
          )}

          {boostSince && (
            <BoostProgress boostSince={boostSince} />
          )}

          {badges.length > 0 && (
            <div className="rounded-xl border border-border bg-card/40 p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                Badges ({badges.length})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {badges.map((badge) => (
                  <div
                    key={badge.name}
                    className="flex items-center gap-2.5 rounded-lg bg-secondary/20 border border-border p-2.5"
                  >
                    <img src={badge.url} alt={badge.tooltip} className="h-6 w-6 shrink-0" />
                    <span className="text-xs text-foreground truncate">{badge.tooltip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Hash size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">ID</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm font-mono text-foreground">{user.id}</span>
              <CopyButton text={user.id} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <User size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Username</span>
            </div>
            <div className="flex items-center">
              <span className="text-sm text-foreground">{user.username}</span>
              <CopyButton text={user.username} />
            </div>
          </div>

          {createdAt && (
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">Conta criada</span>
              </div>
              <div className="text-sm text-foreground">{formatDate(createdAt)}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Há {timeSinceCreation(createdAt)}</div>
            </div>
          )}

          {premiumLabel && (
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Crown size={14} className="text-[#f47fff]" />
                <span className="text-xs font-medium uppercase tracking-wider">Nitro</span>
              </div>
              <div className="text-sm text-foreground flex items-center gap-1.5">
                <Sparkles size={13} className="text-[#f47fff]" />
                {premiumLabel}
              </div>
              {premiumSince && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  Desde {formatDate(premiumSince)} — Há {formatDuration(premiumSince)}
                </div>
              )}
            </div>
          )}

          {boostSince && (
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap size={14} className="text-[#ff73fa]" />
                <span className="text-xs font-medium uppercase tracking-wider">Server Boost</span>
              </div>
              <div className="text-sm text-foreground">Boostando servidor</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Desde {formatDate(boostSince)} — Há {formatDuration(boostSince)}
              </div>
            </div>
          )}

          {user.mfa_enabled !== undefined && (
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Shield size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">2FA</span>
              </div>
              <div className={`text-sm font-medium ${user.mfa_enabled ? "text-green-400" : "text-yellow-400"}`}>
                {user.mfa_enabled ? "Ativada" : "Desativada"}
              </div>
            </div>
          )}

          {user.email && (
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CreditCard size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">Email</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-foreground truncate">
                  {mostrarEmail ? user.email : obfuscarEmail(user.email)}
                </span>
                <button
                  onClick={() => setMostrarEmail(!mostrarEmail)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mostrarEmail ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <CopyButton text={user.email} />
              </div>
              {user.verified !== undefined && (
                <div className={`text-xs mt-0.5 ${user.verified ? "text-green-400" : "text-yellow-400"}`}>
                  {user.verified ? "Verificado" : "Não verificado"}
                </div>
              )}
            </div>
          )}

          {user.phone && (
            <div className="rounded-xl border border-border bg-card/40 p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <CreditCard size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">Telefone</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-foreground">
                  {mostrarTelefone ? user.phone : obfuscarTelefone(user.phone)}
                </span>
                <button
                  onClick={() => setMostrarTelefone(!mostrarTelefone)}
                  className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {mostrarTelefone ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock size={14} />
              <span className="text-xs font-medium uppercase tracking-wider">Adicionada ao app</span>
            </div>
            <div className="text-sm text-foreground">{formatDate(profile.addedAt)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{formatRelative(profile.addedAt)}</div>
          </div>
        </div>
      </div>

      {cachedAt && (
        <div className="text-center">
          <span className="text-[11px] text-muted-foreground">
            Cache atualizado em {formatDate(cachedAt)}
          </span>
        </div>
      )}
    </div>
  )
}
