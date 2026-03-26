import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { clonarServidor } from './clonar-servidor.service'

const router = Router()

const clonarServidorSchema = z.object({
  tokenId: z.string(),
  sourceGuildId: z.string(),
  targetGuildId: z.string(),
})

router.post('/clonar-servidor', validate(clonarServidorSchema), asyncHandler(async (req, res) => {
  await requireConnected(req.body.tokenId)
  const result = await clonarServidor(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
