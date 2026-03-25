'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ws } from '@/lib/ws-client'

/**
 * Hook para gerenciar a conexão WebSocket global
 */
export function useWebSocket() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    ws.connect()

    const unsubConnection = ws.on('connection', (data: unknown) => {
      const { connected: isConnected } = data as { connected: boolean }
      setConnected(isConnected)
    })

    return () => {
      unsubConnection()
    }
  }, [])

  return { connected, ws }
}

/**
 * Hook para escutar eventos específicos do WebSocket
 */
export function useWSEvent<T = unknown>(event: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const unsub = ws.on(event, (data) => {
      handlerRef.current(data as T)
    })
    return unsub
  }, [event])
}

export function useWSLogs() {
  const [logs, setLogs] = useState<Array<{
    id: string
    level: string
    source: string
    message: string
    timestamp: string
  }>>([])

  useWSEvent('log:entry', (entry: unknown) => {
    setLogs((prev) => [...prev.slice(-499), entry as typeof prev[0]])
  })

  const clearLogs = useCallback(() => setLogs([]), [])

  return { logs, clearLogs }
}
