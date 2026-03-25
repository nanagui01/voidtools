

import { useState, useEffect } from "react"
import { ChevronsUpDown, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTokens } from "@/hooks/use-tokens"
import { api } from "@/lib/api-client"
import type { DiscordGuild } from "@/types/discord"

interface GuildPickerProps {
  onSelect: (guildId: string) => void
  disabled?: boolean
}

export function GuildPicker({ onSelect, disabled }: GuildPickerProps) {
  const { activeToken } = useTokens()
  const [open, setOpen] = useState(false)
  const [guilds, setGuilds] = useState<DiscordGuild[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open || !activeToken) return
    setLoading(true)
    api.getTokenGuilds(activeToken.id)
      .then((res) => setGuilds((res.data || []) as DiscordGuild[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, activeToken])

  const filtered = guilds.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) || g.id.includes(search)
  )

  const icon = (g: DiscordGuild) =>
    g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=32` : null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 w-11 shrink-0 px-0" disabled={disabled}>
          <ChevronsUpDown size={16} className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            placeholder="Buscar servidor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {guilds.length === 0 ? "Nenhum servidor" : "Sem resultados"}
            </p>
          ) : (
            filtered.map((g) => (
              <button
                key={g.id}
                onClick={() => { onSelect(g.id); setOpen(false); setSearch("") }}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-secondary/60 transition-colors"
              >
                <div className="h-7 w-7 shrink-0 rounded-md bg-secondary/60 overflow-hidden flex items-center justify-center">
                  {icon(g) ? (
                    <img src={icon(g)!} alt="" className="h-full w-full object-cover" />
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
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
