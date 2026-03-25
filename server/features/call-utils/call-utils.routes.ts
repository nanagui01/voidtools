import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { callUtils, getActiveCallTasks, stopCallTask, toggleMuteCallTask, toggleDeafCallTask } from './call-utils.service'

const router = Router()

const callUtilsSchema = z.object({
  tokenId: z.string(),
  action: z.enum([
    'disconnect-all',
    'move-members',
    'farm-hours',
    'mute-all',
    'unmute-all',
    'deafen-all',
    'undeafen-all',
    'list-members',
    'elevator',
    'leash',
    'protect',
  ]),
  channelId: z.string().optional(),
  sourceChannelId: z.string().optional(),
  targetChannelId: z.string().optional(),
  guildId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  selfMute: z.boolean().optional(),
  selfDeaf: z.boolean().optional(),
})

router.post('/call-utils', validate(callUtilsSchema), asyncHandler(async (req, res) => {
  requireConnected(req.body.tokenId)
  const result = await callUtils(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

router.get('/call-utils/active', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: getActiveCallTasks() })
}))

router.delete('/call-utils/:taskId', asyncHandler(async (req, res) => {
  const stopped = await stopCallTask(req.params.taskId)
  res.json({ success: true, stopped })
}))

router.patch('/call-utils/:taskId/mute', asyncHandler(async (req, res) => {
  const { mute } = req.body as { mute: boolean }
  const toggled = await toggleMuteCallTask(req.params.taskId, !!mute)
  if (!toggled) {
    res.status(404).json({ success: false, error: 'Task não encontrada' })
    return
  }
  res.json({ success: true, mute: !!mute })
}))

router.patch('/call-utils/:taskId/deaf', asyncHandler(async (req, res) => {
  const { deaf } = req.body as { deaf: boolean }
  const toggled = await toggleDeafCallTask(req.params.taskId, !!deaf)
  if (!toggled) {
    res.status(404).json({ success: false, error: 'Task não encontrada' })
    return
  }
  res.json({ success: true, deaf: !!deaf })
}))

export default router
