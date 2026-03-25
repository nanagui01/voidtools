import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { stats } from '../../services/stats.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { backupAntesDeLimpar } from '../backup'
import { decodeBadges, type Badge } from '../../utils/badges'
import type { LimparDmsAbertasConfig } from '../../../src/types/tools'

/**
 * Limpa mensagens de todas as DMs abertas em sequência
 */
export async function limparDmsAbertas(cfg: LimparDmsAbertasConfig) {
  const client = discord.getActiveClient()
  const me = discord.getMe()

  const dms = client.channels.cache
    .filter((c: any) => c.type === 'DM')
    .map((c: any) => c)

  if (dms.length === 0) {
    throw Object.assign(new Error('Você não tem DMs abertas.'), { statusCode: 400 })
  }

  const task = taskManager.createTask('limpar-dms-abertas', {
    ...(cfg as unknown as Record<string, unknown>),
    totalDms: dms.length,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarLimpezaDmsAbertas(task.id, dms, me, cfg).catch(() => {})

  return { taskId: task.id, totalDms: dms.length }
}

async function executarLimpezaDmsAbertas(
  taskId: string,
  dms: any[],
  me: any,
  cfg: LimparDmsAbertasConfig,
) {
  const startTime = Date.now()
  let totalDeletedGlobal = 0

  try {
    for (let i = 0; i < dms.length; i++) {
      if (taskManager.isAborted(taskId)) {
        taskManager.failTask(taskId, 'Cancelado pelo usuário')
        return
      }

      const dm = dms[i]
      const username = dm.recipient?.globalName || dm.recipient?.username || 'DM'
      const userId = dm.recipient?.id || dm.id
      const avatarUrl = dm.recipient?.displayAvatarURL?.({ dynamic: true, size: 256 }) || null

      taskManager.updateProgress(
        taskId, i, dms.length,
        `Processando DM ${i + 1}/${dms.length}: ${username}`,
        'fetching',
        { currentDm: username, dmIndex: i, totalDms: dms.length },
      )

      if (cfg.fazerBackup) {
        const publicFlags = dm.recipient?.publicFlags?.bitfield ?? dm.recipient?.flags?.bitfield ?? 0
        const premiumType = dm.recipient?.premiumType ?? 0
        const badges: Badge[] = decodeBadges(publicFlags, premiumType)

        logger.info('LimparDMsAbertas', `Criando backup de ${username}`)
        await backupAntesDeLimpar(dm.id, username, userId, avatarUrl, badges, cfg.salvarMidiaLocal, taskId)

        if (taskManager.isAborted(taskId)) {
          taskManager.failTask(taskId, 'Cancelado pelo usuário')
          return
        }
      }

      taskManager.updateProgress(
        taskId, i, dms.length,
        `Buscando mensagens com ${username}...`,
        'fetching',
        { currentDm: username, dmIndex: i, totalDms: dms.length },
      )

      const messages: any[] = []
      let lastId: string | undefined

      while (true) {
        if (taskManager.isAborted(taskId)) {
          taskManager.failTask(taskId, 'Cancelado pelo usuário')
          return
        }

        const fetched = await dm.messages.fetch({
          limit: 100,
          ...(lastId && { before: lastId }),
        })

        if (fetched.size === 0) break

        const msgs = Array.from(fetched.values()) as any[]
        const own = msgs.filter((m: any) => m.author.id === me.id && !m.system)
        messages.push(...own)

        lastId = fetched.lastKey()
        if (fetched.size < 100) break
        await sleep(400)
      }

      if (messages.length > 0) {
        let deleted = 0

        for (const msg of messages) {
          if (taskManager.isAborted(taskId)) {
            taskManager.failTask(taskId, `Cancelado (${totalDeletedGlobal + deleted} deletadas)`)
            return
          }

          try {
            await msg.delete()
          } catch {
          }

          deleted++
          totalDeletedGlobal++

          taskManager.updateProgress(
            taskId, deleted, messages.length,
            `${username}: ${deleted}/${messages.length} mensagens removidas (DM ${i + 1}/${dms.length})`,
            'deleting',
            { currentDm: username, dmIndex: i, totalDms: dms.length, dmDeleted: deleted, dmTotal: messages.length },
          )

          await sleep(cfg.delay)
        }

        stats.recordCleanup({
          username,
          userId,
          avatarUrl,
          messagesDeleted: deleted,
          messagesScanned: messages.length,
          duration: 0,
          backup: !!cfg.fazerBackup,
        })
      }

      if (cfg.fecharApos) {
        try {
          await dm.delete()
        } catch {
        }
      }

      logger.info('LimparDMsAbertas', `DM ${i + 1}/${dms.length} processada: ${username} (${messages.length} mensagens)`)
    }

    taskManager.completeTask(taskId)
    logger.success('LimparDMsAbertas', `Concluído: ${dms.length} DMs processadas, ${totalDeletedGlobal} mensagens deletadas`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('LimparDMsAbertas', `Erro: ${err}`)
  }
}
