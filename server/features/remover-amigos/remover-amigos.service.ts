import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { stats } from '../../services/stats.service'
import type { RemoverAmigosConfig } from '../../../src/types/tools'

/**
 * Remove todos os amigos da conta conectada com delay configurável
 */
export async function removerAmigos(cfg: RemoverAmigosConfig) {
  const client = discord.getActiveClient()

  const amigos = discord.listFriends()

  if (amigos.length === 0) {
    throw Object.assign(new Error('Você não tem amigos na lista.'), { statusCode: 400 })
  }

  const task = taskManager.createTask('remover-amigos', {
    ...(cfg as unknown as Record<string, unknown>),
    totalAmigos: amigos.length,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarRemocaoAmigos(task.id, amigos, cfg).catch(() => {})

  return { taskId: task.id, totalAmigos: amigos.length }
}

async function executarRemocaoAmigos(
  taskId: string,
  amigos: string[],
  cfg: RemoverAmigosConfig,
) {
  const startTime = Date.now()
  try {
    let removidos = 0

    taskManager.updateProgress(taskId, 0, amigos.length, `0/${amigos.length} amigos removidos`, 'deleting')

    for (const idAmigo of amigos) {
      if (taskManager.isAborted(taskId)) {
        return
      }

      await sleep(cfg.delay)

      try {
        await discord.removeFriend(idAmigo)
        removidos++
      } catch {
        removidos++
      }

      taskManager.updateProgress(
        taskId, removidos, amigos.length,
        `${removidos}/${amigos.length} amigos removidos`,
        'deleting',
      )
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    stats.recordAction('remover-amigos', duration, {
      friendsRemoved: removidos,
      totalFriends: amigos.length,
    })

    taskManager.completeTask(taskId)
    logger.success('RemoverAmigos', `${removidos} amigos removidos`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('RemoverAmigos', `Erro: ${err}`)
  }
}
