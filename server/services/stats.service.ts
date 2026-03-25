import fs from 'fs'
import path from 'path'
import { config } from '../config'
import { logger } from '../core/logger'

export interface CleanupRecord {
  id: string
  username: string
  userId: string
  avatarUrl: string | null
  messagesDeleted: number
  messagesScanned: number
  duration: number
  date: string
  backup?: boolean
}

export type ToolActionType =
  | 'backup'
  | 'clonar-servidor'
  | 'fechar-dms'
  | 'remover-amigos'
  | 'remover-servidores'
  | 'scraper-icons'
  | 'call-utils'
  | 'prefix-commands'

export interface ToolActionRecord {
  id: string
  type: ToolActionType
  date: string
  duration: number
  details: Record<string, number | string>
}

export interface AnalyticsData {
  totalMessagesDeleted: number
  totalUsersCleanedUnique: number
  totalCleanups: number
  totalTimeSpent: number
  cleanups: CleanupRecord[]
  toolActions: ToolActionRecord[]
}

const DEFAULT_ANALYTICS: AnalyticsData = {
  totalMessagesDeleted: 0,
  totalUsersCleanedUnique: 0,
  totalCleanups: 0,
  totalTimeSpent: 0,
  cleanups: [],
  toolActions: [],
}

class StatsService {
  private filePath: string
  private data: AnalyticsData

  constructor() {
    this.filePath = path.join(config.storage.dataPath, 'analytics.json')
    this.data = { ...DEFAULT_ANALYTICS, cleanups: [], toolActions: [] }
  }

  load(): AnalyticsData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.data = { ...DEFAULT_ANALYTICS, cleanups: [], toolActions: [], ...JSON.parse(raw) }
      }
    } catch (err) {
      logger.error('Stats', `Erro ao carregar analytics: ${err}`)
    }
    return this.data
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Stats', `Erro ao salvar analytics: ${err}`)
    }
  }

  recordCleanup(record: Omit<CleanupRecord, 'id' | 'date'>): void {
    const entry: CleanupRecord = {
      id: `cleanup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...record,
      date: new Date().toISOString(),
    }

    this.data.cleanups.push(entry)
    this.data.totalMessagesDeleted += record.messagesDeleted
    this.data.totalCleanups += 1
    this.data.totalTimeSpent += record.duration

    const uniqueUsers = new Set(this.data.cleanups.map((c) => c.userId))
    this.data.totalUsersCleanedUnique = uniqueUsers.size

    this.save()
    logger.info('Stats', `Cleanup registrado: ${record.messagesDeleted} msgs de ${record.username}`)
  }

  recordAction(type: ToolActionType, duration: number, details: Record<string, number | string>): void {
    const entry: ToolActionRecord = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      date: new Date().toISOString(),
      duration,
      details,
    }

    this.data.toolActions.push(entry)
    this.save()
    logger.info('Stats', `Action registrada: ${type} (${duration}s)`)
  }

  getAnalytics(): AnalyticsData {
    return this.data
  }
}

export const stats = new StatsService()
