import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { criarBackup } from './backup.service'

const router = Router()

const backupSchema = z.object({
  tokenId: z.string(),
  targetId: z.string(),
  salvarMidiaLocal: z.boolean().default(false),
})

router.post('/backup', validate(backupSchema), asyncHandler(async (req, res) => {
  await requireConnected(req.body.tokenId)
  const result = await criarBackup(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
