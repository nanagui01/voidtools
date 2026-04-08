import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { limparDmAmigos } from './limpar-dm-amigos.service'

const router = Router()

const limparDmAmigosSchema = z.object({
  tokenId: z.string(),
  delay: z.number().min(100).default(700),
  fazerBackup: z.boolean().default(false),
  salvarMidiaLocal: z.boolean().default(false),
  fecharApos: z.boolean().default(false),
})

router.post('/limpar-dm-amigos', validate(limparDmAmigosSchema), asyncHandler(async (req, res) => {
  await requireConnected(req.body.tokenId)
  const result = await limparDmAmigos(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
