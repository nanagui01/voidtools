import type { Request, Response, NextFunction } from 'express'
import { logger } from '../core/logger'

interface AppError extends Error {
  statusCode?: number
  code?: string
}

export function errorMiddleware(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Erro interno do servidor'

  logger.error('Server', `${statusCode} - ${message}`, {
    stack: err.stack,
    code: err.code,
  })

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  })
}

export function notFoundMiddleware(_req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada',
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
  })
}
