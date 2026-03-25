type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success'

interface LogEntry {
  level: LogLevel
  source: string
  message: string
  timestamp: string
  meta?: Record<string, unknown>
}

type LogListener = (entry: LogEntry) => void

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[90m',
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m',
}
const RESET = '\x1b[0m'

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 1,
  warn: 2,
  error: 3,
}

type MinLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Sistema de logging centralizado com níveis, cores, histórico e listeners.
 * Suporta broadcast de logs via WebSocket
 */
class Logger {
  private listeners: Set<LogListener> = new Set()
  private history: LogEntry[] = []
  private maxHistory = 1000
  private minLevel: MinLevel = 'info'

  setLevel(level: MinLevel) {
    this.minLevel = level
  }

  getLevel(): MinLevel {
    return this.minLevel
  }

  private emit(level: LogLevel, source: string, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      source,
      message,
      timestamp: new Date().toISOString(),
      meta,
    }

    this.history.push(entry)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) return

    const color = COLORS[level]
    const tag = level.toUpperCase().padEnd(7)
    console.log(`${color}[${tag}]${RESET} [${source}] ${message}`)

    this.listeners.forEach((listener) => listener(entry))
  }

  debug(source: string, message: string, meta?: Record<string, unknown>) {
    this.emit('debug', source, message, meta)
  }

  info(source: string, message: string, meta?: Record<string, unknown>) {
    this.emit('info', source, message, meta)
  }

  warn(source: string, message: string, meta?: Record<string, unknown>) {
    this.emit('warn', source, message, meta)
  }

  error(source: string, message: string, meta?: Record<string, unknown>) {
    this.emit('error', source, message, meta)
  }

  success(source: string, message: string, meta?: Record<string, unknown>) {
    this.emit('success', source, message, meta)
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getHistory(limit?: number): LogEntry[] {
    if (limit) {
      return this.history.slice(-limit)
    }
    return [...this.history]
  }

  clear() {
    this.history = []
  }
}

export const logger = new Logger()
export type { LogEntry, LogLevel, LogListener }
