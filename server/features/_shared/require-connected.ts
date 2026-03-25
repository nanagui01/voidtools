import { storage } from '../../services/storage.service'
import { discord } from '../../services/discord.service'

export function requireConnected(tokenId: string): void {
  const token = storage.getTokenById(tokenId)
  if (!token) throw Object.assign(new Error('Token não encontrada'), { statusCode: 404 })
  if (!discord.isConnected() || discord.getActiveToken() !== token.token) {
    throw Object.assign(new Error('Conta não está conectada. Conecte primeiro.'), { statusCode: 400 })
  }
}
