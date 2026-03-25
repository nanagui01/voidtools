import { EventEmitter } from 'events'
import fs from 'fs'
import https from 'https'
import http from 'http'
import path from 'path'
import { logger } from '../../core/logger'
import { storage } from '../../services/storage.service'
import { monitoringStorage } from '../../services/monitoring-storage.service'
import { discord } from '../../services/discord.service'
import type {
  MonitoringToken,
  MonitoredUser,
  VoiceEvent,
  VoiceEventType,
  CallSession,
  CallParticipant,
  MonitoringLogEntry,
  MonitoredMessage,
  MonitoredAttachment,
  MediaItem,
} from '../../../src/types/monitoring'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('discord.js-selfbot-v13')

/**
 * Serviço de monitoramento em tempo real.
 * Gerencia multi-token, rastreamento de calls, mensagens e download de mídias
 */
class MonitoringService extends EventEmitter {
  private clients: Map<string, any> = new Map()
  private activeSessions: Map<string, CallSession> = new Map()
  private voiceStates: Map<string, {
    channelId: string | null
    selfMute: boolean
    selfDeaf: boolean
    selfVideo: boolean
    selfStream: boolean
    serverMute: boolean
    serverDeaf: boolean
  }> = new Map()

  async init(): Promise<void> {
    monitoringStorage.init()

    const tokens = monitoringStorage.getTokens()
    for (const t of tokens) {
      if (t.status === 'connected' || t.status === 'connecting') {
        this.connectToken(t.id).catch(err => {
          logger.warn('Monitoring', `Falha ao reconectar token ${t.username}: ${err.message}`)
        })
      }
    }
  }

  async addToken(token: string): Promise<MonitoringToken> {
    const userInfo = await discord.fetchUserInfo(token)
    if (!userInfo) throw new Error('Token inválida')

    const activeToken = discord.getActiveToken()
    if (activeToken === token) {
      throw new Error('Esta token já está ativa no painel principal. Use uma token diferente.')
    }

    const existing = monitoringStorage.getTokens().find((t: MonitoringToken) => t.token === token)
    if (existing) throw new Error('Esta token já está configurada no monitoramento')

    const avatarUrl = userInfo.avatar
      ? `https://cdn.discordapp.com/avatars/${userInfo.id}/${userInfo.avatar}.${userInfo.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
      : `https://cdn.discordapp.com/embed/avatars/${parseInt(userInfo.discriminator || '0') % 5}.png`

    const monToken: MonitoringToken = {
      id: `mt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      token,
      userId: userInfo.id,
      username: userInfo.global_name || userInfo.username,
      avatar: userInfo.avatar,
      avatarUrl,
      status: 'disconnected',
      addedAt: new Date().toISOString(),
    }

    monitoringStorage.addToken(monToken)
    logger.info('Monitoring', `Token adicionada: ${monToken.username}`)

    return monToken
  }

  async removeToken(id: string): Promise<boolean> {
    await this.disconnectToken(id)
    const removed = monitoringStorage.removeToken(id)
    if (removed) logger.info('Monitoring', `Token removida: ${id}`)
    return removed
  }

  async connectToken(id: string): Promise<MonitoringToken> {
    const tokenData = monitoringStorage.getTokenById(id)
    if (!tokenData) throw new Error('Token não encontrada')

    const activeToken = discord.getActiveToken()
    if (activeToken === tokenData.token) {
      throw new Error('Esta token está ativa no painel principal. Desconecte-a do painel primeiro.')
    }

    if (this.clients.has(id)) {
      const client = this.clients.get(id)
      if (client?.isReady()) {
        return monitoringStorage.updateToken(id, { status: 'connected' })!
      }
    }

    monitoringStorage.updateToken(id, { status: 'connecting' })
    this.emit('token:status', { id, status: 'connecting' })

    try {
      const client = new Client({ checkUpdate: false })

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          try { client.destroy() } catch {}
          reject(new Error('Timeout ao conectar'))
        }, 20000)

        client.once('ready', () => {
          clearTimeout(timeout)
          resolve()
        })

        client.login(tokenData.token).catch((err: Error) => {
          clearTimeout(timeout)
          reject(err)
        })
      })

      this.clients.set(id, client)
      this.setupEventListeners(id, client)

      const updated = monitoringStorage.updateToken(id, {
        status: 'connected',
        lastConnectedAt: new Date().toISOString(),
        guildCount: client.guilds.cache.size,
      })

      logger.info('Monitoring', `Token conectada: ${tokenData.username} (${client.guilds.cache.size} servidores)`)
      this.emit('token:status', { id, status: 'connected', guildCount: client.guilds.cache.size })

      this.refreshUsersInfo(client).catch(() => {})

      return updated!
    } catch (err: any) {
      monitoringStorage.updateToken(id, { status: 'error' })
      this.emit('token:status', { id, status: 'error', error: err.message })
      throw err
    }
  }

  async disconnectToken(id: string): Promise<void> {
    const client = this.clients.get(id)
    if (client) {
      try { client.destroy() } catch {}
      this.clients.delete(id)
    }
    monitoringStorage.updateToken(id, { status: 'disconnected' })
    this.emit('token:status', { id, status: 'disconnected' })
    logger.info('Monitoring', `Token desconectada: ${id}`)
  }

  async connectAll(): Promise<void> {
    const tokens = monitoringStorage.getTokens()
    for (const t of tokens) {
      if (t.status !== 'connected') {
        await this.connectToken(t.id).catch(err => {
          logger.warn('Monitoring', `Falha ao conectar ${t.username}: ${err.message}`)
        })
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [id] of this.clients) {
      await this.disconnectToken(id)
    }
  }

  private async fetchTargetUser(userId: string): Promise<{ username: string; globalName: string | null; avatar: string | null; avatarUrl: string }> {
    const mainUser = await discord.fetchUser(userId)
    if (mainUser) {
      const avatar = mainUser.avatar || null
      const avatarUrl = mainUser.displayAvatarURL?.({ format: 'png', size: 128 })
        || (avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(mainUser.discriminator || '0') % 5}.png`)
      return {
        username: mainUser.globalName || mainUser.username || `User ${userId}`,
        globalName: mainUser.globalName || null,
        avatar,
        avatarUrl,
      }
    }

    for (const [, client] of this.clients) {
      if (client?.isReady()) {
        const fetched = await client.users.fetch(userId).catch(() => null)
        if (fetched) {
          const avatar = fetched.avatar || null
          const avatarUrl = fetched.displayAvatarURL?.({ format: 'png', size: 128 })
            || (avatar
              ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
              : `https://cdn.discordapp.com/embed/avatars/${parseInt(fetched.discriminator || '0') % 5}.png`)
          return {
            username: fetched.globalName || fetched.username || `User ${userId}`,
            globalName: fetched.globalName || null,
            avatar,
            avatarUrl,
          }
        }
      }
    }

    const tokens = monitoringStorage.getTokens()
    for (const t of tokens) {
      try {
        const userInfo = await discord.request<any>(`/users/${userId}`, t.token)
        if (userInfo?.id) {
          const avatar = userInfo.avatar || null
          const avatarUrl = avatar
            ? `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
            : `https://cdn.discordapp.com/embed/avatars/${parseInt(userInfo.discriminator || '0') % 5}.png`
          return {
            username: userInfo.global_name || userInfo.username || `User ${userId}`,
            globalName: userInfo.global_name || null,
            avatar,
            avatarUrl,
          }
        }
      } catch {}
    }

    return { username: `User ${userId}`, globalName: null, avatar: null, avatarUrl: `https://cdn.discordapp.com/embed/avatars/0.png` }
  }

  private async refreshUsersInfo(client?: any): Promise<void> {
    const users = monitoringStorage.getUsers()
    for (const user of users) {
      try {
        const info = await this.fetchTargetUser(user.userId)
        monitoringStorage.updateUser(user.id, {
          username: info.username,
          globalName: info.globalName,
          avatar: info.avatar,
          avatarUrl: info.avatarUrl,
        })
      } catch {}
    }
    this.emit('users:updated', monitoringStorage.getUsers())
  }

  async addUser(userId: string): Promise<MonitoredUser> {
    const existing = monitoringStorage.getUserByUserId(userId)
    if (existing) throw new Error('Este usuário já está sendo monitorado')

    const { username, globalName, avatar, avatarUrl } = await this.fetchTargetUser(userId)

    const monUser: MonitoredUser = {
      id: `mu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      userId,
      username,
      globalName,
      avatar,
      avatarUrl,
      addedAt: new Date().toISOString(),
      isOnline: false,
    }

    monitoringStorage.addUser(monUser)
    logger.info('Monitoring', `Usuário adicionado para monitoramento: ${username} (${userId})`)
    this.emit('user:added', monUser)

    return monUser
  }

  removeUser(id: string): boolean {
    const user = monitoringStorage.getUsers().find((u: MonitoredUser) => u.id === id)
    if (user && this.activeSessions.has(user.userId)) {
      this.endSession(user.userId)
    }
    const removed = monitoringStorage.removeUser(id)
    if (removed) {
      logger.info('Monitoring', `Usuário removido do monitoramento: ${id}`)
      this.emit('user:removed', { id })
    }
    return removed
  }

  private setupEventListeners(tokenId: string, client: any): void {
    const monitoredUsers = monitoringStorage.getUsers()
    const monitoredIds = new Set(monitoredUsers.map((u: MonitoredUser) => u.userId))

    client.on('voiceStateUpdate', (oldState: any, newState: any) => {
      const userId = newState?.member?.id || oldState?.member?.id
      if (!userId || !monitoredIds.has(userId)) {
        this.handleParticipantVoiceUpdate(oldState, newState)
        return
      }

      this.handleMonitoredVoiceUpdate(userId, oldState, newState, client)
    })

    client.on('messageCreate', (message: any) => {
      if (!message?.author) return
      const authorId = message.author.id

      if (monitoredIds.has(authorId)) {
        this.handleMonitoredMessage(message, false)
      }

      if (message.mentions?.users) {
        for (const [mentionedId] of message.mentions.users) {
          if (monitoredIds.has(mentionedId) && mentionedId !== authorId) {
            this.handleMention(message, mentionedId)
          }
        }
      }
    })

    client.on('messageDelete', (message: any) => {
      if (!message?.author) return
      const authorId = message.author.id
      if (!monitoredIds.has(authorId)) return
      this.handleMessageDelete(authorId, message.id)
    })

    client.on('messageUpdate', (_old: any, newMsg: any) => {
      if (!newMsg?.author) return
      const authorId = newMsg.author.id
      if (!monitoredIds.has(authorId)) return
      this.handleMessageEdit(newMsg)
    })

    this.on('user:added', () => {
      const users = monitoringStorage.getUsers()
      monitoredIds.clear()
      users.forEach((u: MonitoredUser) => monitoredIds.add(u.userId))
    })

    this.on('user:removed', () => {
      const users = monitoringStorage.getUsers()
      monitoredIds.clear()
      users.forEach((u: MonitoredUser) => monitoredIds.add(u.userId))
    })

    client.on('close', () => {
      logger.warn('Monitoring', `Client ${tokenId} desconectou`)
      this.clients.delete(tokenId)
      monitoringStorage.updateToken(tokenId, { status: 'disconnected' })
      this.emit('token:status', { id: tokenId, status: 'disconnected' })
    })
  }

  private handleMonitoredVoiceUpdate(userId: string, oldState: any, newState: any, _client: any): void {
    const prevVoice = this.voiceStates.get(userId) || {
      channelId: oldState?.channelId || null,
      selfMute: oldState?.selfMute || false,
      selfDeaf: oldState?.selfDeaf || false,
      selfVideo: oldState?.selfVideo || false,
      selfStream: oldState?.streaming || false,
      serverMute: oldState?.serverMute || false,
      serverDeaf: oldState?.serverDeaf || false,
    }

    const newVoice = {
      channelId: newState?.channelId || null,
      selfMute: newState?.selfMute || false,
      selfDeaf: newState?.selfDeaf || false,
      selfVideo: newState?.selfVideo || false,
      selfStream: newState?.streaming || false,
      serverMute: newState?.serverMute || false,
      serverDeaf: newState?.serverDeaf || false,
    }

    this.voiceStates.set(userId, newVoice)

    const username = newState?.member?.user?.username || oldState?.member?.user?.username || userId
    const guild = newState?.guild || oldState?.guild
    const guildName = guild?.name || 'Desconhecido'
    const guildId = guild?.id || ''
    const guildIcon = guild?.iconURL?.({ format: 'png', size: 128 }) || null
    const channelName = newState?.channel?.name || oldState?.channel?.name || 'Desconhecido'

    const events: VoiceEvent[] = []
    const now = new Date().toISOString()

    const makeEvent = (type: VoiceEventType, chId?: string, chName?: string): VoiceEvent => ({
      id: `ve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      userId,
      username,
      type,
      timestamp: now,
      channelId: chId || newVoice.channelId || prevVoice.channelId || '',
      channelName: chName || channelName,
      guildId,
      guildName,
      guildIcon,
    })

    if (!prevVoice.channelId && newVoice.channelId) {
      events.push(makeEvent('join'))
      this.startOrUpdateSession(userId, newVoice.channelId, channelName, guildId, guildName, guildIcon, newState)
    }

    if (prevVoice.channelId && !newVoice.channelId) {
      events.push(makeEvent('leave', prevVoice.channelId, oldState?.channel?.name))
      this.endSession(userId)
    }

    if (prevVoice.channelId && newVoice.channelId && prevVoice.channelId !== newVoice.channelId) {
      events.push(makeEvent('move'))
      this.startOrUpdateSession(userId, newVoice.channelId, channelName, guildId, guildName, guildIcon, newState)
    }

    if (!prevVoice.selfVideo && newVoice.selfVideo) events.push(makeEvent('camera_on'))
    if (prevVoice.selfVideo && !newVoice.selfVideo) events.push(makeEvent('camera_off'))

    if (!prevVoice.selfStream && newVoice.selfStream) events.push(makeEvent('screen_on'))
    if (prevVoice.selfStream && !newVoice.selfStream) events.push(makeEvent('screen_off'))

    if (!prevVoice.selfMute && newVoice.selfMute) events.push(makeEvent('mute'))
    if (prevVoice.selfMute && !newVoice.selfMute) events.push(makeEvent('unmute'))
    if (!prevVoice.selfDeaf && newVoice.selfDeaf) events.push(makeEvent('deaf'))
    if (prevVoice.selfDeaf && !newVoice.selfDeaf) events.push(makeEvent('undeaf'))

    if (!prevVoice.serverMute && newVoice.serverMute) events.push(makeEvent('server_mute'))
    if (prevVoice.serverMute && !newVoice.serverMute) events.push(makeEvent('server_unmute'))
    if (!prevVoice.serverDeaf && newVoice.serverDeaf) events.push(makeEvent('server_deaf'))
    if (prevVoice.serverDeaf && !newVoice.serverDeaf) events.push(makeEvent('server_undeaf'))

    for (const event of events) {
      this.emit('voice:event', event)
      monitoringStorage.appendLog({
        id: event.id,
        userId: event.userId,
        username: event.username,
        type: event.type,
        timestamp: event.timestamp,
        channelId: event.channelId,
        channelName: event.channelName,
        guildId: event.guildId,
        guildName: event.guildName,
      })

      const session = this.activeSessions.get(userId)
      if (session) {
        session.events.push(event)
        session.totalDuration = Date.now() - new Date(session.startedAt).getTime()
        monitoringStorage.saveSession(session)
      }
    }

    const monUser = monitoringStorage.getUserByUserId(userId)
    if (monUser) {
      monitoringStorage.updateUser(monUser.id, {
        isOnline: !!newVoice.channelId,
        lastSeen: now,
        currentVoiceChannel: newVoice.channelId ? {
          channelId: newVoice.channelId,
          channelName,
          guildId,
          guildName,
          guildIcon,
        } : null,
      })
    }
  }

  private handleParticipantVoiceUpdate(oldState: any, newState: any): void {
    const userId = newState?.member?.id || oldState?.member?.id
    if (!userId) return

    for (const [monitoredUserId, session] of this.activeSessions) {
      if (monitoredUserId === userId) continue

      const inSameChannel = session.channelId === oldState?.channelId || session.channelId === newState?.channelId

      if (!inSameChannel) continue

      const username = newState?.member?.user?.username || oldState?.member?.user?.username || userId
      const now = new Date().toISOString()

      if (!oldState?.channelId && newState?.channelId === session.channelId) {
        const user = newState?.member?.user
        const avatarHash = user?.avatar || null
        const displayName = user?.globalName || username
        let participant = session.participants.find((p: CallParticipant) => p.userId === userId)
        if (!participant) {
          participant = {
            userId,
            username: displayName,
            avatar: avatarHash,
            avatarUrl: this.buildAvatarUrl(userId, avatarHash, user?.discriminator),
            globalName: user?.globalName || null,
            joinedAt: now,
            totalTime: 0,
            events: [],
          }
          session.participants.push(participant)
        } else {
          participant.joinedAt = now
          participant.leftAt = undefined
          participant.username = displayName
          participant.avatarUrl = this.buildAvatarUrl(userId, avatarHash, user?.discriminator)
          participant.globalName = user?.globalName || null
        }

        const event: VoiceEvent = {
          id: `ve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          userId,
          username,
          type: 'join',
          timestamp: now,
          channelId: session.channelId,
          channelName: session.channelName,
          guildId: session.guildId,
          guildName: session.guildName,
          guildIcon: session.guildIcon,
        }
        session.events.push(event)
        participant.events.push(event)
        this.emit('voice:event', event)
      }

      if (oldState?.channelId === session.channelId && newState?.channelId !== session.channelId) {
        const participant = session.participants.find((p: CallParticipant) => p.userId === userId)
        if (participant && !participant.leftAt) {
          participant.leftAt = now
          participant.totalTime += Date.now() - new Date(participant.joinedAt).getTime()

          const event: VoiceEvent = {
            id: `ve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            userId,
            username,
            type: 'leave',
            timestamp: now,
            channelId: session.channelId,
            channelName: session.channelName,
            guildId: session.guildId,
            guildName: session.guildName,
            guildIcon: session.guildIcon,
          }
          session.events.push(event)
          participant.events.push(event)
          this.emit('voice:event', event)
        }
      }

      const participantRef = session.participants.find((p: CallParticipant) => p.userId === userId)
      if (participantRef) {
        const changes: Array<{ check: boolean; type: VoiceEventType }> = [
          { check: !oldState?.selfVideo && newState?.selfVideo, type: 'camera_on' },
          { check: oldState?.selfVideo && !newState?.selfVideo, type: 'camera_off' },
          { check: !oldState?.streaming && newState?.streaming, type: 'screen_on' },
          { check: oldState?.streaming && !newState?.streaming, type: 'screen_off' },
        ]

        for (const { check, type } of changes) {
          if (check) {
            const event: VoiceEvent = {
              id: `ve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
              userId,
              username,
              type,
              timestamp: now,
              channelId: session.channelId,
              channelName: session.channelName,
              guildId: session.guildId,
              guildName: session.guildName,
              guildIcon: session.guildIcon,
            }
            session.events.push(event)
            participantRef.events.push(event)
            this.emit('voice:event', event)
          }
        }
      }

      monitoringStorage.saveSession(session)
    }
  }

  private startOrUpdateSession(
    userId: string,
    channelId: string,
    channelName: string,
    guildId: string,
    guildName: string,
    guildIcon: string | null,
    voiceState: any,
  ): void {
    let session = this.activeSessions.get(userId)

    if (session && session.channelId === channelId) {
      return
    }

    if (session) {
      this.endSession(userId)
    }

    const now = new Date().toISOString()
    const username = voiceState?.member?.user?.username || userId

    const participants: CallParticipant[] = []
    if (voiceState?.channel?.members) {
      for (const [memberId, member] of voiceState.channel.members) {
        if (memberId === userId) continue
        const user = (member as any).user
        const avatarHash = user?.avatar || null
        const displayName = user?.globalName || user?.username || memberId
        participants.push({
          userId: memberId,
          username: displayName,
          avatar: avatarHash,
          avatarUrl: this.buildAvatarUrl(memberId, avatarHash, user?.discriminator),
          globalName: user?.globalName || null,
          joinedAt: now,
          totalTime: 0,
          events: [{
            id: `ve_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
            userId: memberId,
            username: displayName,
            type: 'join',
            timestamp: now,
            channelId,
            channelName,
            guildId,
            guildName,
            guildIcon,
          }],
        })
      }
    }

    session = {
      id: `cs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      userId,
      username,
      channelId,
      channelName,
      guildId,
      guildName,
      guildIcon,
      startedAt: now,
      totalDuration: 0,
      participants,
      events: [],
      active: true,
    }

    this.activeSessions.set(userId, session)
    monitoringStorage.saveSession(session)
    this.emit('session:start', session)
    logger.info('Monitoring', `Sessão iniciada: ${username} em ${channelName} (${guildName})`)
  }

  private endSession(userId: string): void {
    const session = this.activeSessions.get(userId)
    if (!session) return

    const now = new Date().toISOString()
    session.endedAt = now
    session.active = false
    session.totalDuration = Date.now() - new Date(session.startedAt).getTime()

    for (const p of session.participants) {
      if (!p.leftAt) {
        p.leftAt = now
        p.totalTime += Date.now() - new Date(p.joinedAt).getTime()
      }
    }

    monitoringStorage.saveSession(session)
    this.activeSessions.delete(userId)
    this.emit('session:end', session)
    logger.info('Monitoring', `Sessão encerrada: ${session.username} - ${this.formatDuration(session.totalDuration)}`)
  }

  getActiveSession(userId: string): CallSession | null {
    return this.activeSessions.get(userId) || null
  }

  getAllActiveSessions(): CallSession[] {
    return Array.from(this.activeSessions.values())
  }

  getUserSessions(userId: string, limit = 50): CallSession[] {
    return monitoringStorage.getUserSessions(userId, limit)
  }

  getSession(userId: string, sessionId: string): CallSession | null {
    const active = this.activeSessions.get(userId)
    if (active?.id === sessionId) return active
    return monitoringStorage.getSession(userId, sessionId)
  }

  getUserLogs(userId: string, date?: string): MonitoringLogEntry[] {
    return monitoringStorage.getUserLogs(userId, date)
  }

  getUserLogDates(userId: string): string[] {
    return monitoringStorage.getUserLogDates(userId)
  }

  getUserMessages(userId: string, date?: string, limit?: number): MonitoredMessage[] {
    return monitoringStorage.getUserMessages(userId, date, limit)
  }

  getDeletedMessages(userId: string, limit?: number): MonitoredMessage[] {
    return monitoringStorage.getDeletedMessages(userId, limit)
  }

  getMentions(userId: string, limit?: number): MonitoredMessage[] {
    return monitoringStorage.getMentions(userId, limit)
  }

  getUserMedia(userId: string, type?: string, limit?: number): MediaItem[] {
    return monitoringStorage.getUserMedia(userId, type, limit)
  }

  getUserStats(userId: string) {
    const msgStats = monitoringStorage.getUserStats(userId)
    const sessions = monitoringStorage.getUserSessions(userId, 10000)
    const totalCallTime = sessions.reduce((acc, s) => acc + s.totalDuration, 0)
    const participantIds = new Set<string>()
    const guildIds = new Set<string>()
    for (const s of sessions) {
      if (s.guildId) guildIds.add(s.guildId)
      for (const p of s.participants) participantIds.add(p.userId)
    }

    return {
      ...msgStats,
      totalCalls: sessions.length,
      totalCallTime,
      avgCallDuration: sessions.length > 0 ? totalCallTime / sessions.length : 0,
      uniqueParticipants: participantIds.size,
      totalServers: guildIds.size,
    }
  }

  getDailyCallStats(userId: string, days = 14): Array<{ date: string; totalTime: number; count: number }> {
    const sessions = monitoringStorage.getUserSessions(userId, 10000)
    const map = new Map<string, { totalTime: number; count: number }>()

    for (const s of sessions) {
      const date = new Date(s.startedAt).toISOString().split('T')[0]
      const entry = map.get(date) || { totalTime: 0, count: 0 }
      entry.totalTime += s.totalDuration
      entry.count++
      map.set(date, entry)
    }

    const result: Array<{ date: string; totalTime: number; count: number }> = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = map.get(dateStr) || { totalTime: 0, count: 0 }
      result.push({ date: dateStr, ...entry })
    }
    return result
  }

  getInteractions(userId: string): {
    users: Array<{ userId: string; username: string; avatar: string | null; avatarUrl?: string; messageCount: number; callTime: number; mentionCount: number }>
    channels: Array<{ channelId: string; channelName: string; guildName: string; messageCount: number; callTime: number }>
  } {
    const messages = monitoringStorage.getUserMessages(userId, undefined, 50000)
    const sessions = monitoringStorage.getUserSessions(userId, 10000)

    const userMap = new Map<string, { username: string; avatar: string | null; avatarUrl?: string; messageCount: number; callTime: number; mentionCount: number }>()
    for (const s of sessions) {
      for (const p of s.participants) {
        const entry = userMap.get(p.userId) || { username: p.username, avatar: p.avatar, avatarUrl: p.avatarUrl, messageCount: 0, callTime: 0, mentionCount: 0 }
        entry.callTime += p.totalTime
        if (p.avatarUrl && !entry.avatarUrl) entry.avatarUrl = p.avatarUrl
        userMap.set(p.userId, entry)
      }
    }

    for (const m of messages) {
      if (m.isMention && m.mentionedBy) {
        const entry = userMap.get(m.mentionedBy) || { username: m.mentionedByUsername || m.mentionedBy, avatar: null, messageCount: 0, callTime: 0, mentionCount: 0 }
        entry.mentionCount++
        userMap.set(m.mentionedBy, entry)
      }
    }

    const channelMap = new Map<string, { channelName: string; guildName: string; messageCount: number; callTime: number }>()
    for (const m of messages) {
      const entry = channelMap.get(m.channelId) || { channelName: m.channelName, guildName: m.guildName, messageCount: 0, callTime: 0 }
      entry.messageCount++
      channelMap.set(m.channelId, entry)
    }
    for (const s of sessions) {
      const entry = channelMap.get(s.channelId) || { channelName: s.channelName, guildName: s.guildName, messageCount: 0, callTime: 0 }
      entry.callTime += s.totalDuration
      channelMap.set(s.channelId, entry)
    }

    return {
      users: Array.from(userMap.entries())
        .map(([uid, data]) => ({ userId: uid, ...data }))
        .sort((a, b) => (b.callTime + b.messageCount * 60000) - (a.callTime + a.messageCount * 60000))
        .slice(0, 20),
      channels: Array.from(channelMap.entries())
        .map(([chId, data]) => ({ channelId: chId, ...data }))
        .sort((a, b) => (b.messageCount + b.callTime / 60000) - (a.messageCount + a.callTime / 60000))
        .slice(0, 20),
    }
  }

  getStatus(): {
    connectedTokens: number
    totalTokens: number
    monitoredUsers: number
    activeSessions: number
  } {
    return {
      connectedTokens: this.clients.size,
      totalTokens: monitoringStorage.getTokens().length,
      monitoredUsers: monitoringStorage.getUsers().length,
      activeSessions: this.activeSessions.size,
    }
  }

  getAggregate(): {
    totalCallSessions: number
    totalCallTime: number
    totalMessages: number
    totalDeleted: number
    totalMentions: number
    totalMedia: number
    uniqueParticipants: number
    totalServers: number
    dailyCalls: Array<{ date: string; totalTime: number; count: number }>
    topChannels: Array<{ channelId: string; channelName: string; guildName: string; messageCount: number; callTime: number }>
    topParticipants: Array<{ userId: string; username: string; avatar: string | null; avatarUrl?: string; callTime: number; messageCount: number }>
  } {
    const users = monitoringStorage.getUsers()
    let totalCallSessions = 0
    let totalCallTime = 0
    let totalMessages = 0
    let totalDeleted = 0
    let totalMentions = 0
    let totalMedia = 0
    const participantMap = new Map<string, { username: string; avatar: string | null; avatarUrl?: string; callTime: number; messageCount: number }>()
    const guildIds = new Set<string>()
    const channelMap = new Map<string, { channelName: string; guildName: string; messageCount: number; callTime: number }>()
    const dailyMap = new Map<string, { totalTime: number; count: number }>()

    for (const user of users) {
      const sessions = monitoringStorage.getUserSessions(user.userId, 10000)
      const msgStats = monitoringStorage.getUserStats(user.userId)

      totalMessages += msgStats.totalMessages
      totalDeleted += msgStats.totalDeleted
      totalMentions += msgStats.totalMentions
      totalMedia += msgStats.totalMedia
      totalCallSessions += sessions.length

      for (const s of sessions) {
        totalCallTime += s.totalDuration
        if (s.guildId) guildIds.add(s.guildId)

        const dateKey = new Date(s.startedAt).toISOString().split('T')[0]
        const dayEntry = dailyMap.get(dateKey) || { totalTime: 0, count: 0 }
        dayEntry.totalTime += s.totalDuration
        dayEntry.count++
        dailyMap.set(dateKey, dayEntry)

        const chEntry = channelMap.get(s.channelId) || { channelName: s.channelName, guildName: s.guildName, messageCount: 0, callTime: 0 }
        chEntry.callTime += s.totalDuration
        channelMap.set(s.channelId, chEntry)

        for (const p of s.participants) {
          const pEntry = participantMap.get(p.userId) || { username: p.username, avatar: p.avatar, avatarUrl: p.avatarUrl, callTime: 0, messageCount: 0 }
          pEntry.callTime += p.totalTime
          if (p.avatarUrl && !pEntry.avatarUrl) pEntry.avatarUrl = p.avatarUrl
          participantMap.set(p.userId, pEntry)
        }
      }

      const messages = monitoringStorage.getUserMessages(user.userId, undefined, 10000)
      for (const m of messages) {
        const chEntry = channelMap.get(m.channelId) || { channelName: m.channelName, guildName: m.guildName, messageCount: 0, callTime: 0 }
        chEntry.messageCount++
        channelMap.set(m.channelId, chEntry)
      }
    }

    const dailyCalls: Array<{ date: string; totalTime: number; count: number }> = []
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      const entry = dailyMap.get(dateStr) || { totalTime: 0, count: 0 }
      dailyCalls.push({ date: dateStr, ...entry })
    }

    return {
      totalCallSessions,
      totalCallTime,
      totalMessages,
      totalDeleted,
      totalMentions,
      totalMedia,
      uniqueParticipants: participantMap.size,
      totalServers: guildIds.size,
      dailyCalls,
      topChannels: Array.from(channelMap.entries())
        .map(([chId, d]) => ({ channelId: chId, ...d }))
        .sort((a, b) => (b.messageCount + b.callTime / 60000) - (a.messageCount + a.callTime / 60000))
        .slice(0, 10),
      topParticipants: Array.from(participantMap.entries())
        .map(([uid, d]) => ({ userId: uid, ...d }))
        .sort((a, b) => b.callTime - a.callTime)
        .slice(0, 10),
    }
  }

  private handleMonitoredMessage(message: any, isMention: boolean): void {
    const userId = message.author.id
    const attachments = this.extractAttachments(message)
    const isVoiceMessage = message.flags?.has?.(8192) || false

    const monMsg: MonitoredMessage = {
      id: `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      messageId: message.id,
      userId,
      username: message.author.username,
      content: message.content || '',
      channelId: message.channel?.id || '',
      channelName: message.channel?.name || (message.channel?.type === 'DM' ? 'DM' : 'Desconhecido'),
      guildId: message.guild?.id || '',
      guildName: message.guild?.name || 'DM',
      guildIcon: message.guild?.iconURL?.({ format: 'png', size: 128 }) || null,
      timestamp: message.createdAt?.toISOString() || new Date().toISOString(),
      attachments,
      mentionedUserIds: message.mentions?.users ? Array.from(message.mentions.users.keys()) as string[] : [],
      isMention,
      isVoiceMessage,
      voiceDuration: isVoiceMessage ? (message.attachments?.first()?.duration || 0) : undefined,
      deleted: false,
      sticker: message.stickers?.first() ? { id: message.stickers.first().id, name: message.stickers.first().name } : null,
      embeds: message.embeds?.length || 0,
      replyTo: message.reference?.messageId || undefined,
      eventType: 'create',
    }

    monitoringStorage.appendMessage(monMsg)
    this.emit('message:create', monMsg)

    if (attachments.length > 0) {
      for (const att of attachments) {
        this.downloadAndTrackMedia(monMsg, att)
      }
    }
  }

  private handleMention(message: any, monitoredUserId: string): void {
    const monUser = monitoringStorage.getUserByUserId(monitoredUserId)
    if (!monUser) return

    const monMsg: MonitoredMessage = {
      id: `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      messageId: message.id,
      userId: monitoredUserId,
      username: monUser.username,
      content: message.content || '',
      channelId: message.channel?.id || '',
      channelName: message.channel?.name || 'Desconhecido',
      guildId: message.guild?.id || '',
      guildName: message.guild?.name || 'DM',
      guildIcon: message.guild?.iconURL?.({ format: 'png', size: 128 }) || null,
      timestamp: message.createdAt?.toISOString() || new Date().toISOString(),
      attachments: [],
      mentionedUserIds: [],
      isMention: true,
      mentionedBy: message.author.id,
      mentionedByUsername: message.author.username,
      isVoiceMessage: false,
      deleted: false,
      sticker: null,
      embeds: 0,
      eventType: 'create',
    }

    monitoringStorage.appendMessage(monMsg)
    this.emit('message:mention', monMsg)
  }

  private handleMessageDelete(userId: string, messageId: string): void {
    const updated = monitoringStorage.markMessageDeleted(userId, messageId)
    if (updated) {
      this.emit('message:delete', updated)
    }
  }

  private handleMessageEdit(message: any): void {
    const userId = message.author.id
    const monMsg: MonitoredMessage = {
      id: `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      messageId: message.id,
      userId,
      username: message.author.username,
      content: message.content || '',
      channelId: message.channel?.id || '',
      channelName: message.channel?.name || 'Desconhecido',
      guildId: message.guild?.id || '',
      guildName: message.guild?.name || 'DM',
      guildIcon: message.guild?.iconURL?.({ format: 'png', size: 128 }) || null,
      timestamp: new Date().toISOString(),
      attachments: [],
      mentionedUserIds: [],
      isMention: false,
      isVoiceMessage: false,
      deleted: false,
      editedAt: new Date().toISOString(),
      sticker: null,
      embeds: message.embeds?.length || 0,
      eventType: 'edit',
    }

    monitoringStorage.appendMessage(monMsg)
    this.emit('message:edit', monMsg)
  }

  private extractAttachments(message: any): MonitoredAttachment[] {
    if (!message.attachments?.size) return []
    const result: MonitoredAttachment[] = []
    for (const [, att] of message.attachments) {
      result.push({
        id: att.id,
        filename: att.name || 'unknown',
        url: att.url,
        proxyUrl: att.proxyURL,
        contentType: att.contentType || 'application/octet-stream',
        size: att.size || 0,
        width: att.width || undefined,
        height: att.height || undefined,
      })
    }
    return result
  }

  private downloadAndTrackMedia(monMsg: MonitoredMessage, att: MonitoredAttachment): void {
    const mediaType = this.getMediaType(att.contentType, att.filename)
    const safeFilename = `${monMsg.messageId}_${att.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const mediaItem: MediaItem = {
      id: `mi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      messageId: monMsg.messageId,
      userId: monMsg.userId,
      username: monMsg.username,
      channelId: monMsg.channelId,
      channelName: monMsg.channelName,
      guildId: monMsg.guildId,
      guildName: monMsg.guildName,
      guildIcon: monMsg.guildIcon || null,
      timestamp: monMsg.timestamp,
      attachment: { ...att, localPath: safeFilename },
      type: mediaType,
    }

    monitoringStorage.appendMediaMeta(mediaItem)

    const downloadDir = monitoringStorage.getMediaDir(monMsg.userId)
    const filePath = path.join(downloadDir, safeFilename)

    const url = att.proxyUrl || att.url
    const protocol = url.startsWith('https') ? https : http

    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const ws = fs.createWriteStream(filePath)
        response.pipe(ws)
        ws.on('finish', () => {
          ws.close()
          this.emit('media:downloaded', mediaItem)
          logger.debug('Monitoring', `Media baixada: ${safeFilename}`)
        })
      }
    }).on('error', (err) => {
      logger.warn('Monitoring', `Falha ao baixar media ${att.filename}: ${err.message}`)
    })

    this.emit('media:new', mediaItem)
  }

  private getMediaType(contentType: string, filename: string): 'image' | 'video' | 'audio' | 'document' {
    if (contentType.startsWith('image/')) return 'image'
    if (contentType.startsWith('video/')) return 'video'
    if (contentType.startsWith('audio/') || filename.endsWith('.ogg')) return 'audio'
    return 'document'
  }

  async shutdown(): Promise<void> {
    for (const [userId] of this.activeSessions) {
      this.endSession(userId)
    }

    for (const [id, client] of this.clients) {
      try { client.destroy() } catch {}
      monitoringStorage.updateToken(id, { status: 'disconnected' })
    }
    this.clients.clear()
    this.voiceStates.clear()

    logger.info('Monitoring', 'Serviço de monitoramento encerrado')
  }

  private buildAvatarUrl(userId: string, avatarHash: string | null, discriminator?: string): string {
    if (avatarHash) {
      const ext = avatarHash.startsWith('a_') ? 'gif' : 'png'
      return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=128`
    }
    const idx = parseInt(discriminator || '0') % 5
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
  }

  private formatDuration(ms: number): string {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}h${m % 60}m`
    if (m > 0) return `${m}m${s % 60}s`
    return `${s}s`
  }
}

export const monitoringService = new MonitoringService()
