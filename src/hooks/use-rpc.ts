

import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { api } from "@/lib/api-client"

export function useRpcPresence() {
  const pathname = useLocation().pathname

  useEffect(() => {
    api.updateRpcPresence({ page: pathname }).catch(() => {})
  }, [pathname])
}
