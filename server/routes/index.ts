/**
 * Registra e organiza todas as rotas da API
 * @returns {Router} Router principal com sub-rotas montadas
 */
import { Router } from 'express'
import tokensRouter from './tokens.routes'
import toolsRouter from './tools.routes'
import settingsRouter from './settings.routes'
import statusRouter from './status.routes'
import analyticsRouter from './analytics.routes'
import rpcRouter from './rpc.routes'
import { backupRoutes } from '../features/backup'

const router = Router()

/** Rotas de tokens Discord */
router.use('/tokens', tokensRouter)
/** Rotas de ferramentas e tasks */
router.use('/tools', toolsRouter)
/** Rotas de configurações */
router.use('/settings', settingsRouter)
/** Rotas de analytics */
router.use('/analytics', analyticsRouter)
/** Rotas de backup */
router.use('/backups', backupRoutes)
/** Rotas do Rich Presence */
router.use('/rpc', rpcRouter)
/** Rotas de status e logs */
router.use('/', statusRouter)

export default router
