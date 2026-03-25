import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { stats } from '../../services/stats.service'
import type { FecharDmsConfig } from '../../../src/types/tools'

const DM_CLOSE_DELAY = 1300

/**
 * Fecha todas as DMs abertas da conta conectada
 */
export async function fecharDms(cfg: FecharDmsConfig) {
  const dms = discord.listOpenDMs()

  if (dms.length === 0) {
    throw Object.assign(new Error('Você não tem DMs abertas.'), { statusCode: 400 })
  }

  const task = taskManager.createTask('fechar-dms', {
    ...(cfg as unknown as Record<string, unknown>),
    totalDms: dms.length,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarFechamento(task.id, dms).catch(() => {})

  return { taskId: task.id, totalDms: dms.length }
}

async function executarFechamento(taskId: string, dms: any[]) {
  const startTime = Date.now()
  try {
    let fechadas = 0

    taskManager.updateProgress(taskId, 0, dms.length, `0/${dms.length} DMs fechadas`, 'deleting')

    for (const dm of dms) {
      if (taskManager.isAborted(taskId)) {
        return
      }

      await sleep(DM_CLOSE_DELAY)

      try {
        await dm.delete()
        fechadas++
      } catch {
        fechadas++
      }

      taskManager.updateProgress(
        taskId, fechadas, dms.length,
        `${fechadas}/${dms.length} DMs fechadas`,
        'deleting',
      )
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    stats.recordAction('fechar-dms', duration, {
      dmsClosed: fechadas,
      totalDms: dms.length,
    })

    taskManager.completeTask(taskId)
    logger.success('FecharDMs', `${fechadas} DMs fechadas`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('FecharDMs', `Erro: ${err}`)
  }
}
