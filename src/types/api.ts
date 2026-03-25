export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ServerStatus {
  uptime: number
  version: string
  wsConnections: number
  activeTokens: number
  runningTasks: number
  backgroundTasks: number
}

export interface AppSettings {
  tokens: Array<{ nome: string; token: string }>
  rpc: {
    applicationId: string
    detalhes: string
    estado: string
    nome: string
    imagemUrl: string
    botoes: Array<{ label: string; url: string }>
    desativado: boolean
  }
  corPainel: string
  tema: string
  delay: number
  aguardarFetch: boolean
  aparencia: {
    bloomIntensidade: 'desligado' | 'sutil' | 'normal' | 'intenso'
    estiloCards: 'flat' | 'glass' | 'bordered'
    tamanhoFonte: 'pequeno' | 'normal' | 'grande'
    mostrarGrade: boolean
  }
  general: {
    language: string
    notifications: boolean
    minimizeToTray: boolean
    logLevel: 'debug' | 'info' | 'warn' | 'error'
  }
  storage: {
    backupsDir: string
    logsDir: string
  }
}
