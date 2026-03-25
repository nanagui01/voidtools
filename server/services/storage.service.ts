import fs from 'fs'
import path from 'path'
import { config } from '../config'
import { logger } from '../core/logger'
import type { AppSettings } from '../../src/types/api'
import type { TokenInfo } from '../../src/types/discord'
import type { BackupMeta } from '../features/backup/backup.types'

const DEFAULT_SETTINGS: AppSettings = {
  tokens: [],
  rpc: {
    applicationId: '1486120560617324644',
    detalhes: '>.<',
    estado: '',
    nome: 'BrunnoClear',
    imagemUrl: 'https://i.imgur.com/piwT2gz.jpeg',
    botoes: [],
    desativado: false,
  },
  corPainel: '#ffffff',
  tema: 'custom',
  delay: 700,
  aguardarFetch: true,
  aparencia: {
    bloomIntensidade: 'normal',
    estiloCards: 'flat',
    tamanhoFonte: 'normal',
    mostrarGrade: true,
  },
  general: {
    language: 'pt-BR',
    notifications: true,
    minimizeToTray: false,
    logLevel: 'info',
  },
  storage: {
    backupsDir: path.join(config.storage.dataPath, config.storage.backupsDir),
    logsDir: path.join(config.storage.dataPath, config.storage.logsDir),
  },
}

/**
 * Serviço de persistência local.
 * Gerencia settings, tokens e backups usando arquivos JSON no userData
 */
class StorageService {
  private dataPath: string
  private settings: AppSettings
  private tokens: TokenInfo[]
  private backups: BackupMeta[]

  constructor() {
    this.dataPath = config.storage.dataPath
    this.settings = { ...DEFAULT_SETTINGS }
    this.tokens = []
    this.backups = []
  }

  private ensureDirectories() {
    const dirs = [
      this.dataPath,
      path.join(this.dataPath, config.storage.backupsDir),
      path.join(this.dataPath, config.storage.logsDir),
      path.join(this.dataPath, config.storage.avatarsDir),
    ]

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }

  init() {
    this.dataPath = config.storage.dataPath
    this.settings.storage = {
      backupsDir: path.join(this.dataPath, config.storage.backupsDir),
      logsDir: path.join(this.dataPath, config.storage.logsDir),
    }
    this.ensureDirectories()
    this.loadSettings()
    this.loadTokens()
    this.loadBackups()
    logger.info('Storage', `Dados carregados de ${this.dataPath}`)
    logger.info('Storage', `${this.tokens.length} token(s), ${this.backups.length} backup(s)`)
  }

  loadSettings(): AppSettings {
    const filePath = path.join(this.dataPath, config.storage.settingsFile)
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const parsed = JSON.parse(raw)
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          rpc: { ...DEFAULT_SETTINGS.rpc, ...(parsed.rpc || {}) },
          general: { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) },
          aparencia: { ...DEFAULT_SETTINGS.aparencia, ...(parsed.aparencia || {}) },
        }
        if (this.settings.delay < 100) {
          this.settings.delay = Math.round(this.settings.delay * 1000)
        }
      }
    } catch (err) {
      logger.error('Storage', `Erro ao carregar settings: ${err}`)
    }
    if (this.settings.general?.logLevel) {
      logger.setLevel(this.settings.general.logLevel)
    }
    return this.settings
  }

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    this.settings = { ...this.settings, ...settings }
    const filePath = path.join(this.dataPath, config.storage.settingsFile)
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.settings, null, 2), 'utf-8')
      logger.info('Storage', 'Settings salvas')
    } catch (err) {
      logger.error('Storage', `Erro ao salvar settings: ${err}`)
    }
    if (this.settings.general?.logLevel) {
      logger.setLevel(this.settings.general.logLevel)
    }
    return this.settings
  }

  getSettings(): AppSettings {
    return this.settings
  }

  loadTokens(): TokenInfo[] {
    const filePath = path.join(this.dataPath, config.storage.tokensFile)
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        this.tokens = JSON.parse(raw)
      }
    } catch (err) {
      logger.error('Storage', `Erro ao carregar tokens: ${err}`)
    }
    return this.tokens
  }

  saveTokens(): void {
    const filePath = path.join(this.dataPath, config.storage.tokensFile)
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.tokens, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Storage', `Erro ao salvar tokens: ${err}`)
    }
  }

  getTokens(): TokenInfo[] {
    return this.tokens
  }

  getTokenById(id: string): TokenInfo | undefined {
    return this.tokens.find((t) => t.id === id)
  }

  addToken(token: Omit<TokenInfo, 'id' | 'addedAt' | 'status'>): TokenInfo {
    const newToken: TokenInfo = {
      ...token,
      id: `tk_${Date.now().toString(36)}`,
      status: 'checking',
      addedAt: new Date().toISOString(),
    }
    this.tokens.push(newToken)
    this.saveTokens()
    return newToken
  }

  removeToken(id: string): boolean {
    const index = this.tokens.findIndex((t) => t.id === id)
    if (index === -1) return false
    this.tokens.splice(index, 1)
    this.saveTokens()
    return true
  }

  updateToken(id: string, update: Partial<TokenInfo>): TokenInfo | null {
    const token = this.tokens.find((t) => t.id === id)
    if (!token) return null
    Object.assign(token, update)
    this.saveTokens()
    return token
  }

  private get backupsFile(): string {
    return path.join(this.dataPath, 'backups.json')
  }

  loadBackups(): BackupMeta[] {
    try {
      if (fs.existsSync(this.backupsFile)) {
        this.backups = JSON.parse(fs.readFileSync(this.backupsFile, 'utf-8'))
      }
    } catch (err) {
      logger.error('Storage', `Erro ao carregar backups: ${err}`)
    }
    return this.backups
  }

  private saveBackups(): void {
    try {
      fs.writeFileSync(this.backupsFile, JSON.stringify(this.backups, null, 2), 'utf-8')
    } catch (err) {
      logger.error('Storage', `Erro ao salvar backups: ${err}`)
    }
  }

  getBackups(): BackupMeta[] {
    return this.backups
  }

  addBackup(meta: BackupMeta): void {
    this.backups.unshift(meta)
    this.saveBackups()
  }

  removeBackup(id: string): boolean {
    const index = this.backups.findIndex(b => b.id === id)
    if (index === -1) return false
    this.backups.splice(index, 1)
    this.saveBackups()
    return true
  }

  getBackupPath(filename: string): string {
    return path.join(this.dataPath, config.storage.backupsDir, filename)
  }

  clearAllData(): { deletedFiles: string[] } {
    const deletedFiles: string[] = []

    const tokensPath = path.join(this.dataPath, config.storage.tokensFile)
    if (fs.existsSync(tokensPath)) { fs.unlinkSync(tokensPath); deletedFiles.push('tokens.json') }
    this.tokens = []

    const analyticsPath = path.join(this.dataPath, 'analytics.json')
    if (fs.existsSync(analyticsPath)) { fs.unlinkSync(analyticsPath); deletedFiles.push('analytics.json') }

    if (fs.existsSync(this.backupsFile)) { fs.unlinkSync(this.backupsFile); deletedFiles.push('backups.json') }
    this.backups = []

    const backupsDir = path.join(this.dataPath, config.storage.backupsDir)
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir)
      for (const file of files) {
        const filePath = path.join(backupsDir, file)
        const stat = fs.statSync(filePath)
        if (stat.isDirectory()) {
          fs.rmSync(filePath, { recursive: true })
        } else {
          fs.unlinkSync(filePath)
        }
      }
      deletedFiles.push(`backups/ (${files.length} arquivos)`)
    }

    const logsDir = path.join(this.dataPath, config.storage.logsDir)
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir)
      for (const file of files) { fs.unlinkSync(path.join(logsDir, file)) }
      deletedFiles.push(`logs/ (${files.length} arquivos)`)
    }

    const avatarsDir = path.join(this.dataPath, config.storage.avatarsDir)
    if (fs.existsSync(avatarsDir)) {
      const files = fs.readdirSync(avatarsDir)
      for (const file of files) { fs.unlinkSync(path.join(avatarsDir, file)) }
      deletedFiles.push(`avatars/ (${files.length} arquivos)`)
    }

    logger.info('Storage', `Todos os dados foram limpos: ${deletedFiles.join(', ')}`)
    return { deletedFiles }
  }
}

export const storage = new StorageService()
