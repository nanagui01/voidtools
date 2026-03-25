import type { WSMessage, WSServerEvent } from '@/types/websocket'

const WS_URL = 'ws://127.0.0.1:3777/ws'

type WSEventHandler = (data: unknown) => void

/**
 * Cliente WebSocket singleton.
 * Gerencia conexão, reconexão automática, heartbeat e dispatch de eventos
 */
class WSClient {
  private ws: WebSocket | null = null
  private handlers: Map<string, Set<WSEventHandler>> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private isConnected = false
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 2000

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(WS_URL)
      
      this.ws.onopen = () => {
        this.isConnected = true
        this.reconnectAttempts = 0
        this.startPing()
        this.emit('connection', { connected: true })
        this.send('subscribe:logs', {})
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WSMessage
          this.emit(message.event, message.data)
        } catch { /* invalid message */ }
      }

      this.ws.onclose = () => {
        this.isConnected = false
        this.stopPing()
        this.emit('connection', { connected: false })
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.stopPing()
    this.ws?.close()
    this.ws = null
    this.isConnected = false
  }

  send(event: string, data: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const message: WSMessage = {
      event: event as WSMessage['event'],
      data,
      timestamp: new Date().toISOString(),
    }
    this.ws.send(JSON.stringify(message))
  }

  on(event: string, handler: WSEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)

    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }

  off(event: string, handler: WSEventHandler) {
    this.handlers.get(event)?.delete(handler)
  }

  private emit(event: string, data: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(data))
    this.handlers.get('*')?.forEach((handler) => handler({ event, data }))
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send('ping', {})
    }, 25000)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, this.reconnectDelay * Math.min(this.reconnectAttempts + 1, 5))
  }

  getConnectionStatus(): boolean {
    return this.isConnected
  }

  cancelTask(taskId: string) {
    this.send('tool:cancel', { taskId })
  }

  pauseTask(taskId: string) {
    this.send('tool:pause', { taskId })
  }

  resumeTask(taskId: string) {
    this.send('tool:resume', { taskId })
  }
}

export const ws = new WSClient()
