

import { useLocation } from "react-router-dom"
import { Link } from "react-router-dom"
import { ChevronRight, Home, Minus, Square, X } from "lucide-react"

interface ItemBreadcrumb {
  titulo: string
  href: string
}

const mapaRotas: Record<string, string> = {
  "": "Visão Geral",
  "tokens": "Tokens",
  "logs": "Logs",
  "limpar-dm": "Limpar DM",
  "limpar-dm-amigos": "Limpar DM dos Amigos",
  "limpar-dms": "Limpar DMs Abertas",
  "remover-amigos": "Remover Amigos",
  "sair-servidores": "Sair de Servidores",
  "fechar-dms": "Fechar DMs",
  "abrir-dms": "Abrir DMs",
  "desconectar-call": "Desconectar Call",
  "mover-call": "Mover Call",
  "farm-call": "Farm Call",
  "mutar-call": "Mutar Call",
  "ensurdecer-call": "Ensurdecer Call",
  "listar-call": "Listar Call",
  "elevador": "Elevador",
  "coleira": "Coleira",
  "proteger-user": "Proteger User",
  "silenciar-call": "Silenciar Call",
  "clonar-servidor": "Clonar Servidor",
  "server-info": "Server Info",
  "user-info": "User Info",
  "scraper-icones": "Scraper Ícones",
  "rich-presence": "Rich Presence",
  "zaralho-nickname": "Zaralho Nickname",
  "analytics": "Analytics",
  "configuracoes": "Configurações",
}

export function NavegacaoSuperior() {
  const caminhoAtual = useLocation().pathname
  const segmentos = caminhoAtual.split("/").filter(Boolean)

  const gerarBreadcrumbs = (): ItemBreadcrumb[] => {
    const breadcrumbs: ItemBreadcrumb[] = [
      { titulo: "Início", href: "/" }
    ]

    let caminhoAcumulado = ""
    segmentos.forEach((segmento) => {
      caminhoAcumulado += `/${segmento}`
      const titulo = mapaRotas[segmento] || segmento
      breadcrumbs.push({ titulo, href: caminhoAcumulado })
    })

    return breadcrumbs
  }

  const breadcrumbs = gerarBreadcrumbs()
  const paginaAtual = breadcrumbs[breadcrumbs.length - 1]?.titulo || "Visão Geral"

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex flex-col gap-0.5">
        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((item, indice) => (
            <div key={item.href} className="flex items-center gap-1.5">
              {indice === 0 ? (
                <Link
                  to={item.href}
                  className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  <Home size={14} />
                </Link>
              ) : indice < breadcrumbs.length - 1 ? (
                <Link
                  to={item.href}
                  className="text-muted-foreground transition-colors hover:text-primary"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  {item.titulo}
                </Link>
              ) : (
                <span className="font-medium text-foreground">
                  {item.titulo}
                </span>
              )}
              {indice < breadcrumbs.length - 1 && (
                <ChevronRight size={14} className="text-muted-foreground/50" />
              )}
            </div>
          ))}
        </nav>
        <h1 className="text-lg font-semibold text-foreground">
          {paginaAtual}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
        <span className="text-xs text-muted-foreground">Online</span>

        {typeof window !== 'undefined' && window.electronAPI && (
          <div className="ml-4 flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <button
              onClick={() => window.electronAPI?.window.minimize()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => window.electronAPI?.window.maximize()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Square size={12} />
            </button>
            <button
              onClick={() => window.electronAPI?.window.close()}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/80 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
