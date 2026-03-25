import { Router } from 'express'
import { asyncHandler } from '../_shared'
import { storage } from '../../services/storage.service'
import { config } from '../../config'
import path from 'path'
import fs from 'fs'

const router = Router()

router.get('/sticker-lottie/:id', asyncHandler(async (req, res) => {
  const stickerId = req.params.id
  if (!/^\d+$/.test(stickerId)) {
    res.status(400).json({ error: 'ID inválido' })
    return
  }

  const url = `https://cdn.discordapp.com/stickers/${stickerId}.json`
  const response = await fetch(url)
  if (!response.ok) {
    res.status(response.status).json({ error: 'Sticker não encontrado' })
    return
  }

  const data = await response.json()
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=86400')
  res.json(data)
}))

router.get('/', (_req, res) => {
  const backups = storage.getBackups()
  const settings = storage.getSettings()
  const backupsDir = settings.storage?.backupsDir || path.join(config.storage.dataPath, config.storage.backupsDir)
  const data = backups.map(b => ({
    ...b,
    folderPath: path.join(backupsDir, b.folderName),
  }))
  res.json({ success: true, data, timestamp: new Date().toISOString() })
})

router.get('/:id/data', asyncHandler(async (req, res) => {
  const backup = storage.getBackups().find(b => b.id === req.params.id)
  if (!backup) {
    res.status(404).json({ success: false, error: 'Backup não encontrado', timestamp: new Date().toISOString() })
    return
  }

  const settings = storage.getSettings()
  const backupsDir = settings.storage?.backupsDir || path.join(config.storage.dataPath, config.storage.backupsDir)
  const jsonPath = path.join(backupsDir, backup.folderName, backup.jsonFile)

  if (!fs.existsSync(jsonPath)) {
    res.status(404).json({ success: false, error: 'Arquivo de backup não encontrado', timestamp: new Date().toISOString() })
    return
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  res.json({ success: true, data, timestamp: new Date().toISOString() })
}))

router.get('/:id/assets/:filename', (req, res) => {
  const backup = storage.getBackups().find(b => b.id === req.params.id)
  if (!backup) { res.status(404).end(); return }

  const settings = storage.getSettings()
  const backupsDir = settings.storage?.backupsDir || path.join(config.storage.dataPath, config.storage.backupsDir)
  const safeBase = path.resolve(path.join(backupsDir, backup.folderName, 'assets'))
  const assetPath = path.resolve(path.join(safeBase, req.params.filename))

  if (!assetPath.startsWith(safeBase) || !fs.existsSync(assetPath)) {
    res.status(404).end()
    return
  }

  res.sendFile(assetPath)
})

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params
  const backup = storage.getBackups().find(b => b.id === id)
  if (!backup) {
    res.status(404).json({ success: false, error: 'Backup não encontrado', timestamp: new Date().toISOString() })
    return
  }

  const settings = storage.getSettings()
  const backupsDir = settings.storage?.backupsDir || path.join(config.storage.dataPath, config.storage.backupsDir)
  const pastaBackup = path.join(backupsDir, backup.folderName)

  try {
    if (fs.existsSync(pastaBackup)) {
      fs.rmSync(pastaBackup, { recursive: true, force: true })
    }
  } catch {}

  storage.removeBackup(id)
  res.json({ success: true, timestamp: new Date().toISOString() })
}))

export default router
