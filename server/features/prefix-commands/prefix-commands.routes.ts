import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { prefixCommands } from './prefix-commands.service'

const router = Router()

const prefixCommandsSchema = z.object({
  tokenId: z.string(),
  action: z.enum(['enable', 'disable', 'set-prefix', 'status']),
  prefix: z.string().optional(),
})

router.post('/prefix-commands', validate(prefixCommandsSchema), asyncHandler(async (req, res) => {
  if (req.body.action !== 'status') {
    await requireConnected(req.body.tokenId)
  }
  const result = await prefixCommands(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
