import type { Request, Response, NextFunction } from 'express'
import { logger } from '../core/logger'

export function loggerMiddleware(req: Request, _res: Response, next: NextFunction) {
  const start = Date.now()
  const { method, path } = req

  _res.on('finish', () => {
    const duration = Date.now() - start
    const status = _res.statusCode

    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    logger[level]('HTTP', `${method} ${path} ${status} - ${duration}ms`)
  })

  next()
}
