import { useState, useEffect } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "@/components/layout/sidebar"
import { NavegacaoSuperior } from "@/components/layout/navegacao-superior"
import { FundoBloom } from "@/components/layout/fundo-bloom"
import { Onboarding } from "@/components/layout/onboarding"
import { UpdateBanner } from "@/components/layout/update-banner"
import { api } from "@/lib/api-client"
import { useCorPainel } from "@/hooks/use-cor-painel"
import { useRpcPresence } from "@/hooks/use-rpc"
import { useTokens } from "@/hooks/use-tokens"

export default function LayoutDashboard() {
  const [checking, setChecking] = useState(true)
  const [hasAccounts, setHasAccounts] = useState(true)

  const { tokens, loading, refetch } = useTokens()

  useCorPainel()
  useRpcPresence()

  useEffect(() => {
    api.hasAccounts()
      .then((res) => {
        const data = res.data as { hasAccounts: boolean; count: number }
        setHasAccounts(data.hasAccounts)
      })
      .catch(() => setHasAccounts(true))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    if (!loading && tokens.length === 0 && !checking) {
      api.hasAccounts()
        .then((res) => {
          const data = res.data as { hasAccounts: boolean; count: number }
          setHasAccounts(data.hasAccounts)
        })
        .catch(() => {})
    }
  }, [loading, tokens.length, checking])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <FundoBloom />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Carregando...</span>
        </div>
      </div>
    )
  }

  if (!hasAccounts) {
    return (
      <Onboarding
        onComplete={() => {
          setHasAccounts(true)
          refetch()
        }}
      />
    )
  }

  return (
    <div className="relative min-h-screen bg-background">
      <FundoBloom />
      <Sidebar />
      <main className="relative z-10 ml-64 h-screen overflow-y-auto overflow-x-hidden">
        <NavegacaoSuperior />
        <UpdateBanner />
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
