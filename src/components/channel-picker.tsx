
import { useState, useEffect } from "react"
import { ChevronsUpDown, Search, Loader2, ChevronLeft, Hash, Volume2, Folder } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import type { DiscordGuild, DiscordChannel } from "@/types/discord"

const VOICE_TYPES = [2, 13]
const TEXT_TYPES = [0, 5, 15]
const CATEGORY_TYPE = 4

type ChannelFilter = "voice" | "text" | "category"

interface ChannelPickerProps {
  onSelect: (channelId: string) => void
  disabled?: boolean
  type?: ChannelFilter
  guildId?: string
}

export function ChannelPicker({ onSelect, disabled, type = "voice", guildId: fixedGuildId }: ChannelPickerProps) {
  const { activeToken } = useTokens()
  const [open, setOpen] = useState(false)
  const [guilds, setGuilds] = useState<DiscordGuild[]>([])
  const [channels, setChannels] = useState<DiscordChannel[]>([])
  const [selectedGuild, setSelectedGuild] = useState<DiscordGuild | null>(null)
  const [loadingGuilds, setLoadingGuilds] = useState(false)
  const [loadingChannels, setLoadingChannels] = useState(false)
  const [search, setSearch] = useState("")

  const skipGuildStep = !!fixedGuildId

  useEffect(() => {
    if (!open || !activeToken) return
    if (skipGuildStep && fixedGuildId) {
      setLoadingChannels(true)
      api.getGuildChannels(activeToken.id, fixedGuildId)
        .then((res) => setChannels((res.data || []) as DiscordChannel[]))
        .catch(() => {})
        .finally(() => setLoadingChannels(false))
    } else {
      setLoadingGuilds(true)
      api.getTokenGuilds(activeToken.id)
        .then((res) => setGuilds((res.data || []) as DiscordGuild[]))
        .catch(() => {})
        .finally(() => setLoadingGuilds(false))
    }
  }, [open, activeToken, fixedGuildId, skipGuildStep])

  const handleSelectGuild = (guild: DiscordGuild) => {
    if (!activeToken) return
    setSelectedGuild(guild)
    setLoadingChannels(true)
    setSearch("")
    api.getGuildChannels(activeToken.id, guild.id)
      .then((res) => setChannels((res.data || []) as DiscordChannel[]))
      .catch(() => {})
      .finally(() => setLoadingChannels(false))
  }

  const handleBack = () => {
    setSelectedGuild(null)
    setChannels([])
    setSearch("")
  }

  const handleClose = () => {
    setOpen(false)
    setSelectedGuild(null)
    setChannels([])
    setSearch("")
  }

  const filterTypes = type === "voice" ? VOICE_TYPES : type === "text" ? TEXT_TYPES : [CATEGORY_TYPE]
  const categories = channels.filter((c) => c.type === CATEGORY_TYPE)
  const filteredChannels = channels.filter((c) => filterTypes.includes(c.type))

  const channelsByCategory = categories
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((cat) => ({
      category: cat,
      channels: filteredChannels
        .filter((c) => c.parent_id === cat.id)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    }))
    .filter((g) => g.channels.length > 0)

  const uncategorized = filteredChannels
    .filter((c) => !c.parent_id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const searchFilter = (name: string, id: string) =>
    name.toLowerCase().includes(search.toLowerCase()) || id.includes(search)

  const guildIcon = (g: DiscordGuild) =>
    g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32` : null

  const ChannelIcon = type === "voice" ? Volume2 : type === "text" ? Hash : Folder
  const showingChannels = skipGuildStep || selectedGuild

  const filteredGuilds = guilds.filter((g) => searchFilter(g.name, g.id))

  return (
    <Popover open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 w-11 shrink-0 px-0" disabled={disabled}>
          <ChevronsUpDown size={16} className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
          {showingChannels && !skipGuildStep && (
            <button onClick={handleBack} className="text-muted-foreground hover:text-foreground">
              <ChevronLeft size={16} />
            </button>
          )}
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            placeholder={showingChannels ? "Buscar canal..." : "Buscar servidor..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>

        {selectedGuild && !skipGuildStep && (
          <div className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 bg-secondary/20">
            <div className="h-5 w-5 shrink-0 rounded overflow-hidden bg-secondary/60 flex items-center justify-center">
              {guildIcon(selectedGuild) ? (
                <img src={guildIcon(selectedGuild)!} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[8px] font-medium text-muted-foreground">{selectedGuild.name.charAt(0)}</span>
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground truncate">{selectedGuild.name}</span>
          </div>
        )}

        <div className="max-h-60 overflow-y-auto p-1">
          {(loadingGuilds || loadingChannels) && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          )}

          {!showingChannels && !loadingGuilds && (
            filteredGuilds.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {guilds.length === 0 ? "Nenhum servidor" : "Sem resultados"}
              </p>
            ) : (
              filteredGuilds.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleSelectGuild(g)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-secondary/60 transition-colors"
                >
                  <div className="h-7 w-7 shrink-0 rounded-md bg-secondary/60 overflow-hidden flex items-center justify-center">
                    {guildIcon(g) ? (
                      <img src={guildIcon(g)!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground">{g.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-foreground">{g.name}</p>
                    <p className="font-mono text-[10px] leading-tight text-muted-foreground">{g.id}</p>
                  </div>
                </button>
              ))
            )
          )}

          {showingChannels && !loadingChannels && type === "category" && (() => {
            const cats = categories.filter((c) => searchFilter(c.name || "", c.id)).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            return cats.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhuma categoria</p>
            ) : (
              cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c.id); handleClose() }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary/60 transition-colors"
                >
                  <Folder size={14} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm text-foreground">{c.name}</p>
                    <p className="font-mono text-[10px] leading-tight text-muted-foreground">{c.id}</p>
                  </div>
                </button>
              ))
            )
          })()}

          {showingChannels && !loadingChannels && type !== "category" && (
            filteredChannels.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nenhum canal encontrado</p>
            ) : (
              <>
                {uncategorized.filter((c) => searchFilter(c.name || "", c.id)).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { onSelect(c.id); handleClose() }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary/60 transition-colors"
                  >
                    <ChannelIcon size={14} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm text-foreground">{c.name}</span>
                  </button>
                ))}
                {channelsByCategory.map(({ category, channels: catChannels }) => {
                  const matched = catChannels.filter((c) => searchFilter(c.name || "", c.id))
                  if (matched.length === 0 && search) return null
                  return (
                    <div key={category.id}>
                      <p className="px-2 pt-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{category.name}</p>
                      {(search ? matched : catChannels).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { onSelect(c.id); handleClose() }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left hover:bg-secondary/60 transition-colors"
                        >
                          <ChannelIcon size={14} className="shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate text-sm text-foreground">{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
              </>
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
