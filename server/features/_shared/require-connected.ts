import { storage } from '../../services/storage.service'
import { discord } from '../../services/discord.service'
import { logger } from '../../core/logger'

export async function requireConnected(tokenId: string): Promise<void> {
  const token = storage.getTokenById(tokenId)
  if (!token) throw Object.assign(new Error('Token não encontrada'), { statusCode: 404 })

  if (!discord.isConnected() || discord.getActiveToken() !== token.token) {
    logger.info('requireConnected', `Client desconectado, tentando reconectar tokenId=${tokenId}...`)
    try {
      await discord.connect(token.token)
      discord.setSelectedTokenId(token.id)
    } catch (err) {
      logger.error('requireConnected', `Falha ao reconectar: ${err}`)
      throw Object.assign(new Error('Conta não está conectada. Conecte primeiro.'), { statusCode: 400 })
    }
  }
}
