import { Router } from 'express'
import { z } from 'zod'
import path from 'path'
import { validate } from '../../middleware'
import { asyncHandler } from '../_shared'
import { monitoringService } from './monitoring.service'
import { monitoringStorage } from '../../services/monitoring-storage.service'

const router = Router()

router.get('/monitoring/status', asyncHandler(async (_req, res) => {
  const status = monitoringService.getStatus()
  const tokens = monitoringStorage.getTokens().map(t => ({
    ...t,
    token: t.token.slice(0, 10) + '...' + t.token.slice(-5),
  }))
  const users = monitoringStorage.getUsers()
  const activeSessions = monitoringService.getAllActiveSessions()

  res.json({
    success: true,
    data: { ...status, tokens, users, activeSessions },
    timestamp: new Date().toISOString(),
  })
}))

const addTokenSchema = z.object({
  token: z.string().min(20),
})

router.post('/monitoring/tokens', validate(addTokenSchema), asyncHandler(async (req, res) => {
  const result = await monitoringService.addToken(req.body.token)
  res.status(201).json({
    success: true,
    data: { ...result, token: result.token.slice(0, 10) + '...' + result.token.slice(-5) },
    timestamp: new Date().toISOString(),
  })
}))

router.delete('/monitoring/tokens/:id', asyncHandler(async (req, res) => {
  const removed = await monitoringService.removeToken(req.params.id)
  res.json({ success: true, data: { removed }, timestamp: new Date().toISOString() })
}))

router.post('/monitoring/tokens/:id/connect', asyncHandler(async (req, res) => {
  const result = await monitoringService.connectToken(req.params.id)
  res.json({
    success: true,
    data: { ...result, token: result.token.slice(0, 10) + '...' + result.token.slice(-5) },
    timestamp: new Date().toISOString(),
  })
}))

router.post('/monitoring/tokens/:id/disconnect', asyncHandler(async (req, res) => {
  await monitoringService.disconnectToken(req.params.id)
  res.json({ success: true, timestamp: new Date().toISOString() })
}))

router.post('/monitoring/tokens/connect-all', asyncHandler(async (_req, res) => {
  await monitoringService.connectAll()
  res.json({ success: true, timestamp: new Date().toISOString() })
}))

const addUserSchema = z.object({
  userId: z.string().min(15).max(25),
})

router.post('/monitoring/users', validate(addUserSchema), asyncHandler(async (req, res) => {
  const result = await monitoringService.addUser(req.body.userId)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

router.delete('/monitoring/users/:id', asyncHandler(async (req, res) => {
  const removed = monitoringService.removeUser(req.params.id)
  res.json({ success: true, data: { removed }, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users', asyncHandler(async (_req, res) => {
  const users = monitoringStorage.getUsers()
  res.json({ success: true, data: users, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/sessions/active', asyncHandler(async (_req, res) => {
  const sessions = monitoringService.getAllActiveSessions()
  res.json({ success: true, data: sessions, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/sessions', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50
  const sessions = monitoringService.getUserSessions(req.params.userId, limit)
  res.json({ success: true, data: sessions, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/sessions/:sessionId', asyncHandler(async (req, res) => {
  const session = monitoringService.getSession(req.params.userId, req.params.sessionId)
  if (!session) {
    res.status(404).json({ success: false, error: 'Sessão não encontrada', timestamp: new Date().toISOString() })
    return
  }
  res.json({ success: true, data: session, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/logs', asyncHandler(async (req, res) => {
  const date = req.query.date as string | undefined
  const logs = monitoringService.getUserLogs(req.params.userId, date)
  res.json({ success: true, data: logs, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/logs/dates', asyncHandler(async (req, res) => {
  const dates = monitoringService.getUserLogDates(req.params.userId)
  res.json({ success: true, data: dates, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/messages', asyncHandler(async (req, res) => {
  const date = req.query.date as string | undefined
  const limit = parseInt(req.query.limit as string) || 200
  const messages = monitoringService.getUserMessages(req.params.userId, date, limit)
  res.json({ success: true, data: messages, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/messages/deleted', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 200
  const messages = monitoringService.getDeletedMessages(req.params.userId, limit)
  res.json({ success: true, data: messages, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/messages/mentions', asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 200
  const mentions = monitoringService.getMentions(req.params.userId, limit)
  res.json({ success: true, data: mentions, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/messages/dates', asyncHandler(async (req, res) => {
  const dates = monitoringStorage.getUserMessageDates(req.params.userId)
  res.json({ success: true, data: dates, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/media', asyncHandler(async (req, res) => {
  const type = req.query.type as string | undefined
  const limit = parseInt(req.query.limit as string) || 200
  const media = monitoringService.getUserMedia(req.params.userId, type, limit)
  res.json({ success: true, data: media, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/media/file/:filename', asyncHandler(async (req, res) => {
  const filename = req.params.filename
  const safe = path.basename(filename)
  const filePath = monitoringStorage.getMediaFilePath(req.params.userId, safe)
  if (!filePath) {
    res.status(404).json({ success: false, error: 'Arquivo não encontrado', timestamp: new Date().toISOString() })
    return
  }
  res.sendFile(filePath)
}))

router.get('/monitoring/users/:userId/stats', asyncHandler(async (req, res) => {
  const stats = monitoringService.getUserStats(req.params.userId)
  res.json({ success: true, data: stats, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/calls/daily', asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days as string) || 14
  const dailyStats = monitoringService.getDailyCallStats(req.params.userId, days)
  res.json({ success: true, data: dailyStats, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/users/:userId/interactions', asyncHandler(async (req, res) => {
  const interactions = monitoringService.getInteractions(req.params.userId)
  res.json({ success: true, data: interactions, timestamp: new Date().toISOString() })
}))

router.get('/monitoring/aggregate', asyncHandler(async (_req, res) => {
  const aggregate = monitoringService.getAggregate()
  res.json({ success: true, data: aggregate, timestamp: new Date().toISOString() })
}))

export default router
