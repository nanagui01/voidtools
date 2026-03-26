import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { analisarPackage, limparPackage } from './limpar-package.service'

const router = Router()

const analisarSchema = z.object({
  tokenId: z.string(),
  zipPath: z.string(),
  whitelist: z.array(z.string()).default([]),
})

router.post('/limpar-package/analisar', validate(analisarSchema), asyncHandler(async (req, res) => {
  await requireConnected(req.body.tokenId)
  const result = await analisarPackage({
    zipPath: req.body.zipPath,
    whitelist: req.body.whitelist,
  })
  res.status(200).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

const limparSchema = z.object({
  tokenId: z.string(),
  zipPath: z.string(),
  whitelist: z.array(z.string()).default([]),
  delay: z.number().min(100).default(700),
  fazerBackup: z.boolean().default(false),
  salvarMidiaLocal: z.boolean().default(false),
  continuar: z.boolean().default(false),
})

router.post('/limpar-package', validate(limparSchema), asyncHandler(async (req, res) => {
  await requireConnected(req.body.tokenId)
  const result = await limparPackage(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
