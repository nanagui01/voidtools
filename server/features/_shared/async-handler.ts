import type { Request, Response, NextFunction } from 'express'

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err: any) => {
      const statusCode = err.statusCode || 500
      const message = err.message || 'Erro interno'
      res.status(statusCode).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      })
    })
  }
}
