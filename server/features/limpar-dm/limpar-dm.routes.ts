import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { limparDm } from './limpar-dm.service'

const router = Router()

const limparDmSchema = z.object({
  tokenId: z.string(),
  targetId: z.string(),
  delay: z.number().min(100).default(700),
  aguardarFetch: z.boolean().default(true),
  fazerBackup: z.boolean().default(false),
  salvarMidiaLocal: z.boolean().default(false),
})

router.post('/limpar-dm', validate(limparDmSchema), asyncHandler(async (req, res) => {
  requireConnected(req.body.tokenId)
  const result = await limparDm(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
