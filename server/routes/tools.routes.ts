/**
 * Rotas de ferramentas e gerenciamento de tasks
 * @returns {Router} Listagem, cancelamento e limpeza de tasks
 */
import { Router } from 'express'
import { taskManager } from '../services/task-manager.service'
import { stopCallTask } from '../features/call-utils/call-utils.service'
import { stopPrefixTask } from '../features/prefix-commands/prefix-commands.service'
import featureRoutes from '../features/registry'

const router = Router()

/**
 * Retorna todas as tasks registradas
 * @returns {Object} Lista completa de tasks
 */
router.get('/tasks', (_req, res) => {
  const tasks = taskManager.getAllTasks()
  res.json({ success: true, data: tasks, timestamp: new Date().toISOString() })
})

/**
 * Retorna apenas as tasks em execução
 * @returns {Object} Lista de tasks ativas
 */
router.get('/tasks/running', (_req, res) => {
  const tasks = taskManager.getRunningTasks()
  res.json({ success: true, data: tasks, timestamp: new Date().toISOString() })
})

/**
 * Cancela uma task específica pelo ID
 * @returns {Object} Confirmação de cancelamento
 */
router.post('/tasks/:id/cancel', async (req, res) => {
  const taskId = req.params.id
  const task = taskManager.getTask(taskId)

  if (task?.tool === 'call-utils') {
    await stopCallTask(taskId)
  }

  if (task?.tool === 'prefix-commands') {
    await stopPrefixTask(taskId)
  }

  taskManager.cancelTask(taskId)
  res.json({ success: true, message: 'Task cancelada', timestamp: new Date().toISOString() })
})

/**
 * Remove todas as tasks concluídas
 * @returns {Object} Confirmação de limpeza
 */
router.delete('/tasks/completed', (_req, res) => {
  taskManager.clearCompleted()
  res.json({ success: true, message: 'Tasks concluídas limpas', timestamp: new Date().toISOString() })
})

router.use('/', featureRoutes)

export default router
