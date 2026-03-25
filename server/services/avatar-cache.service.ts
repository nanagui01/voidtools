import fs from 'fs'
import path from 'path'
import { config } from '../config'
import { logger } from '../core/logger'
import { storage } from './storage.service'

const AVATAR_CDN = 'https://cdn.discordapp.com/avatars'
const DEFAULT_AVATAR_CDN = 'https://cdn.discordapp.com/embed/avatars'

function getAvatarsDir(): string {
  return path.join(config.storage.dataPath, config.storage.avatarsDir)
}

function getAvatarFilePath(userId: string, hash: string): string {
  const ext = hash.startsWith('a_') ? 'gif' : 'png'
  return path.join(getAvatarsDir(), `${userId}_${hash}.${ext}`)
}

function getDefaultAvatarFilePath(userId: string): string {
  return path.join(getAvatarsDir(), `${userId}_default.png`)
}

async function downloadAvatar(url: string, destPath: string): Promise<boolean> {
  try {
    const response = await fetch(url)
    if (!response.ok) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    fs.writeFileSync(destPath, buffer)
    return true
  } catch (err) {
    logger.error('AvatarCache', `Erro ao baixar avatar: ${err}`)
    return false
  }
}

function cleanOldAvatars(userId: string, keepHash?: string | null): void {
  const dir = getAvatarsDir()
  try {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      if (!file.startsWith(`${userId}_`)) continue
      if (keepHash && file.includes(keepHash)) continue
      if (!keepHash && file === `${userId}_default.png`) continue
      try {
        fs.unlinkSync(path.join(dir, file))
      } catch { /* arquivo em uso */ }
    }
  } catch { /* dir não existe */ }
}

export async function cacheAvatar(
  userId: string,
  avatarHash: string | null,
): Promise<string | null> {
  if (!avatarHash) {
    const defaultIndex = Number((BigInt(userId) >> BigInt(22)) % BigInt(6))
    const destPath = getDefaultAvatarFilePath(userId)

    if (!fs.existsSync(destPath)) {
      const url = `${DEFAULT_AVATAR_CDN}/${defaultIndex}.png`
      const ok = await downloadAvatar(url, destPath)
      if (!ok) return null
    }
    cleanOldAvatars(userId, null)
    return `${userId}_default.png`
  }

  const destPath = getAvatarFilePath(userId, avatarHash)

  if (fs.existsSync(destPath)) {
    return path.basename(destPath)
  }

  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png'
  const url = `${AVATAR_CDN}/${userId}/${avatarHash}.${ext}?size=128`
  const ok = await downloadAvatar(url, destPath)

  if (ok) {
    cleanOldAvatars(userId, avatarHash)
    return path.basename(destPath)
  }

  return null
}

export function getCachedAvatarPath(userId: string): string | null {
  const dir = getAvatarsDir()
  try {
    const files = fs.readdirSync(dir)
    const match = files.find((f) => f.startsWith(`${userId}_`))
    if (match) return path.join(dir, match)
  } catch { /* dir não existe */ }
  return null
}

export async function refreshAvatar(
  userId: string,
  currentAvatarHash: string | null,
  tokenId: string,
): Promise<boolean> {
  const token = storage.getTokenById(tokenId)
  if (!token?.user) return false

  const savedHash = token.user.avatar
  const changed = savedHash !== currentAvatarHash

  if (changed) {
    logger.info('AvatarCache', `Avatar de ${token.user.username} mudou, atualizando cache...`)
    storage.updateToken(tokenId, {
      user: { ...token.user, avatar: currentAvatarHash },
    })
  }

  await cacheAvatar(userId, currentAvatarHash)
  return changed
}

export async function refreshAllAvatars(): Promise<void> {
  const tokens = storage.getTokens()
  if (tokens.length === 0) return

  logger.info('AvatarCache', `Cacheando avatares de ${tokens.length} conta(s) (sem API calls)...`)

  for (const token of tokens) {
    if (token.status !== 'valid' || !token.user?.id) continue

    try {
      await cacheAvatar(token.user.id, token.user.avatar ?? null)
      logger.info('AvatarCache', `Avatar de ${token.user.username || token.label} OK`)
    } catch (err) {
      logger.warn('AvatarCache', `Erro ao cachear avatar de ${token.label}: ${err}`)
    }
  }

  logger.info('AvatarCache', 'Cache de avatares concluído')
}
