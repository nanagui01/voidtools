import fs from 'fs'
import path from 'path'
import { config } from '../config'
import { logger } from '../core/logger'
import type {
  MonitoringConfig,
  MonitoringToken,
  MonitoredUser,
  CallSession,
  VoiceEvent,
  MonitoringLogEntry,
  MonitoredMessage,
  MediaItem,
  MonitoredAttachment,
} from '../../src/types/monitoring'

const MONITORING_DIR = 'monitoring'
const CONFIG_FILE = 'monitoring-config.json'
const SESSIONS_DIR = 'sessions'
const LOGS_DIR = 'logs'
const MESSAGES_DIR = 'messages'
const MEDIA_DIR = 'media'
const MEDIA_META_DIR = 'media-meta'

/**
 * Serviço de armazenamento do monitoramento.
 * Persiste configurações, sessões de call, logs e mídias monitoradas
 */
class MonitoringStorageService {
  private basePath: string
  private configData: MonitoringConfig = { tokens: [], users: [] }

  constructor() {
    this.basePath = path.join(config.storage.dataPath, MONITORING_DIR)
  }

  init() {
    this.basePath = path.join(config.storage.dataPath, MONITORING_DIR)

    const dirs = [
      this.basePath,
      path.join(this.basePath, SESSIONS_DIR),
      path.join(this.basePath, LOGS_DIR),
      path.join(this.basePath, MESSAGES_DIR),
      path.join(this.basePath, MEDIA_DIR),
      path.join(this.basePath, MEDIA_META_DIR),
    ]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    this.loadConfig()
    logger.info('MonitoringStorage', `Inicializado: ${this.configData.tokens.length} token(s), ${this.configData.users.length} user(s)`)
  }

  private get configPath(): string {
    return path.join(this.basePath, CONFIG_FILE)
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8')
        const parsed = JSON.parse(raw) as MonitoringConfig
        this.configData = {
          tokens: parsed.tokens || [],
          users: parsed.users || [],
        }
      }
    } catch (err) {
      logger.error('MonitoringStorage', `Erro ao carregar config: ${err}`)
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.configData, null, 2), 'utf-8')
    } catch (err) {
      logger.error('MonitoringStorage', `Erro ao salvar config: ${err}`)
    }
  }

  getConfig(): MonitoringConfig {
    return this.configData
  }

  getTokens(): MonitoringToken[] {
    return this.configData.tokens
  }

  addToken(token: MonitoringToken): MonitoringToken {
    this.configData.tokens.push(token)
    this.saveConfig()
    return token
  }

  removeToken(id: string): boolean {
    const idx = this.configData.tokens.findIndex(t => t.id === id)
    if (idx === -1) return false
    this.configData.tokens.splice(idx, 1)
    this.saveConfig()
    return true
  }

  updateToken(id: string, update: Partial<MonitoringToken>): MonitoringToken | null {
    const token = this.configData.tokens.find(t => t.id === id)
    if (!token) return null
    Object.assign(token, update)
    this.saveConfig()
    return token
  }

  getTokenById(id: string): MonitoringToken | undefined {
    return this.configData.tokens.find(t => t.id === id)
  }

  getUsers(): MonitoredUser[] {
    return this.configData.users
  }

  addUser(user: MonitoredUser): MonitoredUser {
    this.configData.users.push(user)
    this.saveConfig()
    return user
  }

  removeUser(id: string): boolean {
    const idx = this.configData.users.findIndex(u => u.id === id)
    if (idx === -1) return false
    this.configData.users.splice(idx, 1)
    this.saveConfig()
    return true
  }

  updateUser(id: string, update: Partial<MonitoredUser>): MonitoredUser | null {
    const user = this.configData.users.find(u => u.id === id)
    if (!user) return null
    Object.assign(user, update)
    this.saveConfig()
    return user
  }

  getUserByUserId(userId: string): MonitoredUser | undefined {
    return this.configData.users.find(u => u.userId === userId)
  }

  private getUserSessionsDir(userId: string): string {
    const dir = path.join(this.basePath, SESSIONS_DIR, userId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  saveSession(session: CallSession): void {
    try {
      const dir = this.getUserSessionsDir(session.userId)
      const filename = `${session.id}.json`
      fs.writeFileSync(path.join(dir, filename), JSON.stringify(session, null, 2), 'utf-8')
    } catch (err) {
      logger.error('MonitoringStorage', `Erro ao salvar sessão: ${err}`)
    }
  }

  getSession(userId: string, sessionId: string): CallSession | null {
    try {
      const dir = this.getUserSessionsDir(userId)
      const filePath = path.join(dir, `${sessionId}.json`)
      if (!fs.existsSync(filePath)) return null
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    } catch {
      return null
    }
  }

  getUserSessions(userId: string, limit = 50): CallSession[] {
    try {
      const dir = this.getUserSessionsDir(userId)
      if (!fs.existsSync(dir)) return []
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, limit)

      return files.map(f => {
        const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
        return JSON.parse(raw) as CallSession
      })
    } catch {
      return []
    }
  }

  appendLog(entry: MonitoringLogEntry): void {
    try {
      const date = new Date(entry.timestamp).toISOString().split('T')[0]
      const dir = path.join(this.basePath, LOGS_DIR, entry.userId)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, `${date}.jsonl`)
      fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf-8')
    } catch (err) {
      logger.error('MonitoringStorage', `Erro ao append log: ${err}`)
    }
  }

  getUserLogs(userId: string, date?: string, limit = 200): MonitoringLogEntry[] {
    try {
      const dir = path.join(this.basePath, LOGS_DIR, userId)
      if (!fs.existsSync(dir)) return []

      if (date) {
        const filePath = path.join(dir, `${date}.jsonl`)
        if (!fs.existsSync(filePath)) return []
        return this.parseLogFile(filePath, limit)
      }

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .sort((a, b) => b.localeCompare(a))

      if (files.length === 0) return []
      return this.parseLogFile(path.join(dir, files[0]), limit)
    } catch {
      return []
    }
  }

  getUserLogDates(userId: string): string[] {
    try {
      const dir = path.join(this.basePath, LOGS_DIR, userId)
      if (!fs.existsSync(dir)) return []
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => f.replace('.jsonl', ''))
        .sort((a, b) => b.localeCompare(a))
    } catch {
      return []
    }
  }

  private parseLogFile(filePath: string, limit: number): MonitoringLogEntry[] {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.slice(-limit).map(line => JSON.parse(line))
  }

  appendMessage(msg: MonitoredMessage): void {
    try {
      const date = new Date(msg.timestamp).toISOString().split('T')[0]
      const dir = path.join(this.basePath, MESSAGES_DIR, msg.userId)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, `${date}.jsonl`)
      fs.appendFileSync(filePath, JSON.stringify(msg) + '\n', 'utf-8')
    } catch (err) {
      logger.error('MonitoringStorage', `Erro ao append message: ${err}`)
    }
  }

  getUserMessages(userId: string, date?: string, limit = 200): MonitoredMessage[] {
    try {
      const dir = path.join(this.basePath, MESSAGES_DIR, userId)
      if (!fs.existsSync(dir)) return []

      if (date) {
        const filePath = path.join(dir, `${date}.jsonl`)
        if (!fs.existsSync(filePath)) return []
        return this.parseJsonlFile<MonitoredMessage>(filePath, limit)
      }

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .sort((a, b) => b.localeCompare(a))

      if (files.length === 0) return []

      const results: MonitoredMessage[] = []
      for (const file of files) {
        const items = this.parseJsonlFile<MonitoredMessage>(path.join(dir, file), limit - results.length)
        results.push(...items)
        if (results.length >= limit) break
      }
      return results.slice(0, limit)
    } catch {
      return []
    }
  }

  getDeletedMessages(userId: string, limit = 200): MonitoredMessage[] {
    const allMsgs = this.getUserMessages(userId, undefined, 5000)
    const deleted = allMsgs.filter(m => m.deleted)
    const deduped = new Map<string, MonitoredMessage>()
    for (const m of deleted) deduped.set(m.id, m)
    return Array.from(deduped.values()).slice(0, limit)
  }

  getMentions(userId: string, limit = 200): MonitoredMessage[] {
    const allMsgs = this.getUserMessages(userId, undefined, 5000)
    return allMsgs.filter(m => m.isMention).slice(0, limit)
  }

  markMessageDeleted(userId: string, messageId: string): MonitoredMessage | null {
    try {
      const dir = path.join(this.basePath, MESSAGES_DIR, userId)
      if (!fs.existsSync(dir)) return null

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .sort((a, b) => b.localeCompare(a))

      for (const file of files) {
        const filePath = path.join(dir, file)
        const content = fs.readFileSync(filePath, 'utf-8')
        const lines = content.trim().split('\n').filter(Boolean)
        let found = false
        const updated = lines.map(line => {
          const msg = JSON.parse(line) as MonitoredMessage
          if (msg.messageId === messageId && !msg.deleted) {
            msg.deleted = true
            msg.deletedAt = new Date().toISOString()
            found = true
            return JSON.stringify(msg)
          }
          return line
        })
        if (found) {
          fs.writeFileSync(filePath, updated.join('\n') + '\n', 'utf-8')
          return JSON.parse(updated.find(l => {
            const m = JSON.parse(l) as MonitoredMessage
            return m.messageId === messageId
          })!)
        }
      }
      return null
    } catch {
      return null
    }
  }

  getUserMessageDates(userId: string): string[] {
    try {
      const dir = path.join(this.basePath, MESSAGES_DIR, userId)
      if (!fs.existsSync(dir)) return []
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => f.replace('.jsonl', ''))
        .sort((a, b) => b.localeCompare(a))
    } catch {
      return []
    }
  }

  getMediaDir(userId: string): string {
    const dir = path.join(this.basePath, MEDIA_DIR, userId)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  appendMediaMeta(item: MediaItem): void {
    try {
      const date = new Date(item.timestamp).toISOString().split('T')[0]
      const dir = path.join(this.basePath, MEDIA_META_DIR, item.userId)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, `${date}.jsonl`)
      fs.appendFileSync(filePath, JSON.stringify(item) + '\n', 'utf-8')
    } catch (err) {
      logger.error('MonitoringStorage', `Erro ao append media meta: ${err}`)
    }
  }

  getUserMedia(userId: string, type?: string, limit = 200): MediaItem[] {
    try {
      const dir = path.join(this.basePath, MEDIA_META_DIR, userId)
      if (!fs.existsSync(dir)) return []

      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .sort((a, b) => b.localeCompare(a))

      const results: MediaItem[] = []
      for (const file of files) {
        const items = this.parseJsonlFile<MediaItem>(path.join(dir, file), limit * 2)
        for (const item of items) {
          if (type && item.type !== type) continue
          results.push(item)
          if (results.length >= limit) break
        }
        if (results.length >= limit) break
      }
      return results.slice(0, limit)
    } catch {
      return []
    }
  }

  getMediaFilePath(userId: string, filename: string): string | null {
    const filePath = path.join(this.basePath, MEDIA_DIR, userId, filename)
    if (!fs.existsSync(filePath)) return null
    return filePath
  }

  getUserStats(userId: string): {
    totalMessages: number
    totalDeleted: number
    totalMentions: number
    totalMedia: number
    totalImages: number
    totalVideos: number
    totalAudios: number
    totalDocuments: number
  } {
    const messages = this.getUserMessages(userId, undefined, 50000)
    const media = this.getUserMedia(userId, undefined, 50000)

    return {
      totalMessages: messages.filter(m => !m.deleted).length,
      totalDeleted: messages.filter(m => m.deleted).length,
      totalMentions: messages.filter(m => m.isMention).length,
      totalMedia: media.length,
      totalImages: media.filter(m => m.type === 'image').length,
      totalVideos: media.filter(m => m.type === 'video').length,
      totalAudios: media.filter(m => m.type === 'audio').length,
      totalDocuments: media.filter(m => m.type === 'document').length,
    }
  }

  private parseJsonlFile<T>(filePath: string, limit: number): T[] {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.slice(-limit).map(line => JSON.parse(line))
  }
}

export const monitoringStorage = new MonitoringStorageService()
