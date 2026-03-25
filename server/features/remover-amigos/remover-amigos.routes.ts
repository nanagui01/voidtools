import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { removerAmigos } from './remover-amigos.service'

const router = Router()

const removerAmigosSchema = z.object({
  tokenId: z.string(),
  delay: z.number().min(100).default(1000),
})

router.post('/remover-amigos', validate(removerAmigosSchema), asyncHandler(async (req, res) => {
  requireConnected(req.body.tokenId)
  const result = await removerAmigos(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
