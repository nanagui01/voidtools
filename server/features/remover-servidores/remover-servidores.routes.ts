import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { removerServidores } from './remover-servidores.service'

const router = Router()

const removerServidoresSchema = z.object({
  tokenId: z.string(),
  delay: z.number().min(100).default(1000),
})

router.post('/remover-servidores', validate(removerServidoresSchema), asyncHandler(async (req, res) => {
  await requireConnected(req.body.tokenId)
  const result = await removerServidores(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
