/**
 * Rotas de status e logs do servidor
 * @returns {Router} Uptime, conexões, tasks ativas e histórico de logs
 */
import { Router } from 'express'
import { config } from '../config'
import { wsManager } from '../core/websocket'
import { taskManager } from '../services/task-manager.service'
import { storage } from '../services/storage.service'
import { logger } from '../core/logger'

const router = Router()
const startTime = Date.now()

/**
 * Retorna o status geral do servidor
 * @returns {Object} Uptime, versão, conexões e tasks
 */
router.get('/status', (_req, res) => {
  res.json({
    success: true,
    data: {
      uptime: Date.now() - startTime,
      version: config.app.version,
      name: config.app.name,
      wsConnections: wsManager.getConnectionCount(),
      activeTokens: storage.getTokens().filter((t) => t.status === 'valid').length,
      runningTasks: taskManager.getRunningTasks().length,
      backgroundTasks: taskManager.getAllTasks().filter((t) => t.status === 'running').length,
      totalTasks: taskManager.getAllTasks().length,
    },
    timestamp: new Date().toISOString(),
  })
})

/**
 * Retorna o histórico de logs do servidor
 * @returns {Object} Lista de logs com limite configurável
 */
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100
  const logs = logger.getHistory(limit)
  res.json({ success: true, data: logs, timestamp: new Date().toISOString() })
})

/**
 * Limpa todo o histórico de logs
 * @returns {Object} Confirmação de limpeza
 */
router.delete('/logs', (_req, res) => {
  logger.clear()
  res.json({ success: true, message: 'Logs limpos', timestamp: new Date().toISOString() })
})

export default router
