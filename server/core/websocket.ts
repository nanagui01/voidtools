import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import { config } from '../config'
import { WS_EVENTS } from '../config/constants'
import { logger } from './logger'
import { taskManager } from '../services/task-manager.service'
import type { WSMessage, WSLogEntry } from '../../src/types/websocket'

interface WSClient {
  ws: WebSocket
  id: string
  subscribedToLogs: boolean
  lastPing: number
}

/**
 * Gerenciador de conexões WebSocket.
 * Controla broadcast de eventos, logs em tempo real e heartbeat dos clientes
 */
class WebSocketManager {
  private wss: WebSocketServer | null = null
  private clients: Map<string, WSClient> = new Map()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private logUnsubscribe: (() => void) | null = null

  init(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: config.websocket.path,
      maxPayload: config.websocket.maxPayload,
    })

    this.wss.on('connection', (ws) => this.handleConnection(ws))
    this.startHeartbeat()
    this.subscribeToTaskEvents()
    this.subscribeToLogs()

    logger.info('WebSocket', `Servidor WS iniciado em ${config.websocket.path}`)
  }

  private handleConnection(ws: WebSocket) {
    const clientId = `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`

    const client: WSClient = {
      ws,
      id: clientId,
      subscribedToLogs: false,
      lastPing: Date.now(),
    }

    this.clients.set(clientId, client)
    logger.info('WebSocket', `Cliente conectado: ${clientId} (${this.clients.size} total)`)

    this.sendTo(clientId, WS_EVENTS.SERVER.SERVER_STATUS, {
      connectedClients: this.clients.size,
      runningTasks: taskManager.getRunningTasks().length,
      allTasks: taskManager.getAllTasks(),
    })

    ws.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString()) as WSMessage
        this.handleMessage(clientId, message)
      } catch {
        this.sendTo(clientId, WS_EVENTS.SERVER.ERROR, { message: 'Mensagem inválida' })
      }
    })

    ws.on('close', () => {
      this.clients.delete(clientId)
      logger.info('WebSocket', `Cliente desconectado: ${clientId} (${this.clients.size} total)`)
    })

    ws.on('error', (err) => {
      logger.error('WebSocket', `Erro no cliente ${clientId}: ${err.message}`)
      this.clients.delete(clientId)
    })
  }

  private handleMessage(clientId: string, message: WSMessage) {
    const { event, data } = message
    const client = this.clients.get(clientId)
    if (!client) return

    switch (event) {
      case WS_EVENTS.CLIENT.PING:
        client.lastPing = Date.now()
        this.sendTo(clientId, WS_EVENTS.SERVER.PONG, { timestamp: new Date().toISOString() })
        break

      case WS_EVENTS.CLIENT.SUBSCRIBE_LOGS:
        client.subscribedToLogs = true
        this.sendTo(clientId, WS_EVENTS.SERVER.LOG_ENTRY, {
          message: 'Inscrito em logs em tempo real',
          level: 'info',
        })
        break

      case WS_EVENTS.CLIENT.UNSUBSCRIBE_LOGS:
        client.subscribedToLogs = false
        break

      case WS_EVENTS.CLIENT.TOOL_CANCEL: {
        const { taskId } = data as { taskId: string }
        taskManager.cancelTask(taskId)
        break
      }

      case WS_EVENTS.CLIENT.TOOL_PAUSE: {
        const { taskId } = data as { taskId: string }
        taskManager.pauseTask(taskId)
        break
      }

      case WS_EVENTS.CLIENT.TOOL_RESUME: {
        const { taskId } = data as { taskId: string }
        taskManager.resumeTask(taskId)
        break
      }

      default:
        logger.warn('WebSocket', `Evento desconhecido: ${event}`)
    }
  }

  private subscribeToTaskEvents() {
    taskManager.on('task:progress', (data) => {
      this.broadcast(WS_EVENTS.SERVER.TOOL_PROGRESS, data)
    })

    taskManager.on('task:completed', (task) => {
      this.broadcast(WS_EVENTS.SERVER.TOOL_COMPLETED, {
        taskId: task.id,
        tool: task.tool,
        results: task.results,
        duration: task.completedAt
          ? new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime()
          : 0,
      })
    })

    taskManager.on('task:error', (data) => {
      this.broadcast(WS_EVENTS.SERVER.TOOL_ERROR, data)
    })

    taskManager.on('task:cancelled', (task) => {
      this.broadcast(WS_EVENTS.SERVER.TOOL_ERROR, {
        taskId: task.id,
        tool: task.tool,
        error: 'Task cancelada pelo usuário',
      })
    })
  }

  private subscribeToLogs() {
    this.logUnsubscribe = logger.subscribe((entry) => {
      const logEntry: WSLogEntry = {
        id: `log_${Date.now().toString(36)}`,
        ...entry,
      }

      for (const [clientId, client] of this.clients) {
        if (client.subscribedToLogs && client.ws.readyState === WebSocket.OPEN) {
          this.sendTo(clientId, WS_EVENTS.SERVER.LOG_ENTRY, logEntry)
        }
      }
    })
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      const timeout = config.websocket.heartbeatInterval * 2

      for (const [clientId, client] of this.clients) {
        if (now - client.lastPing > timeout) {
          logger.warn('WebSocket', `Cliente ${clientId} timeout - desconectando`)
          client.ws.terminate()
          this.clients.delete(clientId)
        }
      }
    }, config.websocket.heartbeatInterval)
  }

  private sendTo(clientId: string, event: string, data: unknown) {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) return

    const message: WSMessage = {
      event: event as WSMessage['event'],
      data,
      timestamp: new Date().toISOString(),
    }

    client.ws.send(JSON.stringify(message))
  }

  broadcast(event: string, data: unknown) {
    for (const [clientId] of this.clients) {
      this.sendTo(clientId, event, data)
    }
  }

  getConnectionCount(): number {
    return this.clients.size
  }

  shutdown() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval)
    if (this.logUnsubscribe) this.logUnsubscribe()

    for (const [, client] of this.clients) {
      client.ws.close(1001, 'Servidor encerrando')
    }
    this.clients.clear()
    this.wss?.close()
  }
}

export const wsManager = new WebSocketManager()
