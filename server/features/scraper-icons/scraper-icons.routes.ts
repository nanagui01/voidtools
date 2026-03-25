import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware'
import { asyncHandler, requireConnected } from '../_shared'
import { scraperIcons } from './scraper-icons.service'

const router = Router()

const scraperIconsSchema = z.object({
  tokenId: z.string(),
  sourceChannelId: z.string(),
  fileType: z.enum(['png/jpg', 'gif', 'todos']),
  sendMethod: z.enum(['webhook', 'channel']),
  webhookUrl: z.string().optional(),
  targetChannelId: z.string().optional(),
  imagesPerMessage: z.number().min(1).max(10).default(5),
  delay: z.number().min(100).default(1000),
})

router.post('/scraper-icons', validate(scraperIconsSchema), asyncHandler(async (req, res) => {
  requireConnected(req.body.tokenId)
  const result = await scraperIcons(req.body)
  res.status(201).json({ success: true, data: result, timestamp: new Date().toISOString() })
}))

export default router
