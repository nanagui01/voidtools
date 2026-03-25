import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { limparDmsAbertas } from './limpar-dms-abertas.service'

const router = Router()

const limparDmsAbertasSchema = z.object({
  tokenId: z.string(),
  delay: z.number().min(100).default(700),
  fazerBackup: z.boolean().default(false),
  salvarMidiaLocal: z.boolean().default(false),
  fecharApos: z.boolean().default(false),
})

router.post('/limpar-dms-abertas', validate(limparDmsAbertasSchema), asyncHandler(async (req, res) => {
  requireConnected(req.body.tokenId)
  const result = await limparDmsAbertas(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
