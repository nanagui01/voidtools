import { useState } from "react"
import { Palette, Check, Sparkles, ChevronRight, Paintbrush } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TEMAS, type ThemeDefinition } from "@/lib/themes"
import { ColorPicker } from "@/components/ui/color-picker"
import { Input } from "@/components/ui/input"

const COLOR_PRESETS = [
  "#ffffff",
  "#00ff88",
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#a855f7",
  "#3b82f6",
  "#f43f5e",
]

interface ThemePickerModalProps {
  tema: string
  corPainel: string
  onSelectTema: (temaId: string) => void
  onSelectCor: (cor: string) => void
}

function MiniPreview({ theme, cor }: { theme?: ThemeDefinition; cor?: string }) {
  const bg = theme?.cores.background ?? "#000"
  const fg = theme?.cores.foreground ?? "#e5e5e5"
  const primary = theme?.cores.primary ?? cor ?? "#fff"
  const sidebar = theme?.cores.sidebar ?? "#050505"
  const card = theme?.cores.card ?? "#0a0a0a"
  const border = theme?.cores.border ?? "#1a1a1a"
  const muted = theme?.cores.mutedForeground ?? "#737373"

  return (
    <div
      className="h-full w-full rounded-lg overflow-hidden"
      style={{ background: bg }}
    >
      {/* Sidebar */}
      <div className="flex h-full">
        <div className="w-[22%] h-full flex flex-col gap-1 p-1.5" style={{ background: sidebar, borderRight: `1px solid ${border}` }}>
          <div className="h-1.5 w-3/4 rounded-full" style={{ background: primary }} />
          <div className="h-1 w-full rounded-full opacity-40" style={{ background: muted }} />
          <div className="h-1 w-4/5 rounded-full opacity-30" style={{ background: muted }} />
          <div className="h-1 w-full rounded-full opacity-20" style={{ background: muted }} />
        </div>
        {/* Content */}
        <div className="flex-1 p-1.5 flex flex-col gap-1">
          <div className="h-1.5 w-1/3 rounded-full" style={{ background: fg, opacity: 0.8 }} />
          <div className="flex gap-1 flex-1 mt-0.5">
            <div className="flex-1 rounded" style={{ background: card, border: `1px solid ${border}` }}>
              <div className="p-1">
                <div className="h-1 w-3/4 rounded-full mb-0.5" style={{ background: muted, opacity: 0.5 }} />
                <div className="h-2 w-full rounded" style={{ background: primary, opacity: 0.2 }} />
              </div>
            </div>
            <div className="flex-1 rounded" style={{ background: card, border: `1px solid ${border}` }}>
              <div className="p-1">
                <div className="h-1 w-1/2 rounded-full mb-0.5" style={{ background: muted, opacity: 0.5 }} />
                <div className="h-2 w-full rounded" style={{ background: primary, opacity: 0.15 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ThemePickerModal({
  tema,
  corPainel,
  onSelectTema,
  onSelectCor,
}: ThemePickerModalProps) {
  const [open, setOpen] = useState(false)

  const activeTema = TEMAS.find((t) => t.id === tema)
  const currentLabel = tema === "custom" ? "Custom" : activeTema?.nome ?? "Padrão"
  const currentDesc = tema === "custom" ? "Sua cor personalizada" : activeTema?.descricao ?? "Tema escuro clássico"

  return (
    <>
      {/* Botão trigger */}
      <button
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-xl border border-border bg-secondary/20 p-3 transition-all hover:border-primary/40 hover:bg-secondary/30"
      >
        {/* Mini preview */}
        <div className="h-14 w-24 shrink-0 rounded-lg border border-white/5 overflow-hidden shadow-lg shadow-black/20">
          {tema === "custom" ? (
            <div className="flex h-full w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${corPainel}15, ${corPainel}05)` }}>
              <div className="h-8 w-8 rounded-full shadow-lg" style={{ backgroundColor: corPainel, boxShadow: `0 0 20px ${corPainel}40` }} />
            </div>
          ) : (
            <MiniPreview theme={activeTema} />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground">{currentLabel}</p>
          <p className="text-xs text-muted-foreground truncate">{currentDesc}</p>
        </div>
        <ChevronRight size={16} className="text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[680px] gap-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles size={14} className="text-primary" />
              </div>
              Escolha um tema
            </DialogTitle>
            <DialogDescription>
              Selecione um tema para personalizar a aparência do painel
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {/* Custom */}
            <button
              onClick={() => onSelectTema("custom")}
              className={`group relative flex flex-col rounded-xl border overflow-hidden transition-all ${
                tema === "custom"
                  ? "border-primary ring-1 ring-primary/30 shadow-lg shadow-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
            >
              {tema === "custom" && (
                <div className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-md">
                  <Check size={10} className="text-primary-foreground" strokeWidth={3} />
                </div>
              )}
              {/* Preview area */}
              <div className="relative h-20 w-full bg-gradient-to-br from-secondary/60 to-secondary/20 flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div
                    className="h-10 w-10 rounded-full border-2 border-dashed border-muted-foreground/40 transition-all group-hover:scale-105"
                    style={tema === "custom" ? {
                      backgroundColor: corPainel,
                      borderStyle: "solid",
                      borderColor: "rgba(255,255,255,0.15)",
                      boxShadow: `0 0 24px ${corPainel}30`,
                    } : undefined}
                  />
                  <Paintbrush size={16} className="text-muted-foreground/60" />
                </div>
              </div>
              <div className="p-3 text-left bg-card/60">
                <p className="text-xs font-semibold text-foreground">Custom</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Escolha sua cor</p>
              </div>
            </button>

            {/* Temas predefinidos */}
            {TEMAS.map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectTema(t.id)}
                className={`group relative flex flex-col rounded-xl border overflow-hidden transition-all ${
                  tema === t.id
                    ? "border-primary ring-1 ring-primary/30 shadow-lg shadow-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {tema === t.id && (
                  <div className="absolute top-2 right-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-md">
                    <Check size={10} className="text-primary-foreground" strokeWidth={3} />
                  </div>
                )}
                {/* Mini preview do tema */}
                <div className="relative h-20 w-full">
                  <MiniPreview theme={t} />
                </div>
                <div className="p-3 text-left bg-card/60 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-foreground">{t.nome}</p>
                    <div className="flex gap-1 ml-auto">
                      {t.previewColors.map((c, i) => (
                        <div
                          key={i}
                          className="h-3 w-3 rounded-full border border-white/10"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t.descricao}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Color picker quando Custom está selecionado */}
          {tema === "custom" && (
            <div className="rounded-xl border border-border bg-secondary/10 p-4">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 block">
                Cor do Painel
              </label>
              <div className="flex items-start gap-6">
                <ColorPicker
                  value={corPainel}
                  onChange={onSelectCor}
                  onChangeEnd={onSelectCor}
                />
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Hex
                    </label>
                    <Input
                      value={corPainel}
                      onChange={(e) => onSelectCor(e.target.value)}
                      className="max-w-[120px] border-border bg-secondary/40 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5 block">
                      Presets
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((color) => (
                        <button
                          key={color}
                          onClick={() => onSelectCor(color)}
                          className={`h-7 w-7 rounded-full border-2 transition-all hover:scale-110 ${
                            corPainel === color
                              ? "border-primary ring-2 ring-primary/30 scale-110"
                              : "border-border"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
