import path from 'path'

/**
 * Obtém a versão do app via Electron ou fallback para package.json
 * @returns {string} Versão no formato semver
 */
function getAppVersion(): string {
  try {
    const { app } = require('electron')
    return app.getVersion()
  } catch {}
  try {
    const pkgPath = path.resolve(__dirname, '../../../package.json')
    return require(pkgPath).version
  } catch {}
  return '0.0.0'
}

let _dataPath: string | null = null

/**
 * Resolve o diretório de dados do app (userData do Electron ou .data local)
 * @returns {string} Caminho absoluto do diretório de dados
 */
function getDataPath(): string {
  if (_dataPath) return _dataPath
  try {
    const { app } = require('electron')
    _dataPath = app.getPath('userData')
  } catch {
    _dataPath = path.resolve(process.cwd(), '.data')
  }
  return _dataPath!
}

/**
 * Inicializa o dataPath usando o Electron userData.
 * Deve ser chamado após o app.ready
 */
export function initDataPath(): void {
  try {
    const { app } = require('electron')
    _dataPath = app.getPath('userData')
    config.storage.dataPath = _dataPath!
  } catch {}
}

export const config = {
  server: {
    port: parseInt(process.env.API_PORT || '3777', 10),
    host: '127.0.0.1',
  },

  discord: {
    defaultDelay: 1500,
    maxRetries: 3,
    rateLimitBuffer: 500,
  },

  storage: {
    dataPath: getDataPath(),
    tokensFile: 'tokens.json',
    settingsFile: 'settings.json',
    backupsDir: 'backups',
    logsDir: 'logs',
    avatarsDir: 'avatars',
  },

  websocket: {
    path: '/ws',
    heartbeatInterval: 30000,
    maxPayload: 1024 * 1024,
  },

  app: {
    name: 'BrunnoClear',
    version: getAppVersion(),
  },
}

export type AppConfig = typeof config
