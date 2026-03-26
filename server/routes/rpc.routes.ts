/**
 * Rotas de controle do Discord Rich Presence (RPC)
 * @returns {Router} Toggle, restart, config e presence do RPC
 */
import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../middleware/validation.middleware'
import { storage } from '../services/storage.service'
import {
  initRPC,
  destroyRPC,
  restartRPC,
  updatePresence,
  updatePagePresence,
  isRPCActive,
  getStatus,
  fetchAppInfo,
} from '../services/rpc.service'

const router = Router()

/**
 * Retorna o status atual do RPC
 * @returns {Object} Estado do RPC com configurações
 */
router.get('/status', (_req, res) => {
  const status = getStatus()
  const settings = storage.getSettings()
  res.json({
    success: true,
    data: { ...status, config: settings.rpc },
    timestamp: new Date().toISOString(),
  })
})

/**
 * Liga ou desliga o Rich Presence
 * @returns {Object} Estado ativo/inativo do RPC
 */
router.post('/toggle', async (_req, res) => {
  if (isRPCActive()) {
    await destroyRPC()
    const settings = storage.getSettings()
    storage.saveSettings({ rpc: { ...settings.rpc, desativado: true } })
    res.json({ success: true, data: { active: false }, timestamp: new Date().toISOString() })
  } else {
    const settings = storage.getSettings()
    storage.saveSettings({ rpc: { ...settings.rpc, desativado: false } })
    const ok = await initRPC()
    if (ok) await updatePresence()
    res.json({ success: true, data: { active: ok }, timestamp: new Date().toISOString() })
  }
})

/**
 * Reinicia a conexão do RPC
 * @returns {Object} Estado após reinicialização
 */
router.post('/restart', async (_req, res) => {
  const ok = await restartRPC()
  if (ok) await updatePresence()
  res.json({ success: true, data: { active: ok }, timestamp: new Date().toISOString() })
})

const updateConfigSchema = z.object({
  applicationId: z.string().optional(),
  detalhes: z.string().optional(),
  estado: z.string().optional(),
  nome: z.string().optional(),
  imagemUrl: z.string().optional(),
  botoes: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
})

/**
 * Atualiza as configurações do RPC
 * @returns {Object} Nova configuração aplicada
 */
router.patch('/config', validate(updateConfigSchema), async (req, res) => {
  const settings = storage.getSettings()
  const newRpc = { ...settings.rpc, ...req.body }
  storage.saveSettings({ rpc: newRpc })

  if (req.body.applicationId && req.body.applicationId !== settings.rpc.applicationId) {
    if (isRPCActive()) {
      await restartRPC()
    }
  }

  if (isRPCActive()) {
    await updatePresence()
  }

  res.json({ success: true, data: newRpc, timestamp: new Date().toISOString() })
})

const presenceSchema = z.object({
  page: z.string().optional(),
  details: z.string().optional(),
  state: z.string().optional(),
})

/**
 * Atualiza a presence exibida no Discord
 * @returns {Object} Confirmação de atualização
 */
router.post('/presence', validate(presenceSchema), async (req, res) => {
  if (req.body.page) {
    await updatePagePresence(req.body.page)
  } else {
    await updatePresence(req.body)
  }
  res.json({ success: true, timestamp: new Date().toISOString() })
})

/**
 * Busca informações de um app Discord pelo ID
 * @returns {Object} Dados do aplicativo
 */
router.get('/app-info/:appId', async (req, res) => {
  const { appId } = req.params
  if (!/^\d{17,20}$/.test(appId)) {
    res.status(400).json({ success: false, error: 'ID inválido', timestamp: new Date().toISOString() })
    return
  }
  const info = await fetchAppInfo(appId)
  res.json({ success: true, data: info, timestamp: new Date().toISOString() })
})

export default router
