import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { stats } from '../../services/stats.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { backupAntesDeLimpar } from '../backup'
import { decodeBadges, type Badge } from '../../utils/badges'
import type { LimparDmAmigosConfig } from '../../../src/types/tools'

/**
 * Limpa mensagens de DMs com amigos selecionados da conta conectada
 */
export async function limparDmAmigos(cfg: LimparDmAmigosConfig) {
  const client = discord.getActiveClient()
  const me = discord.getMe()

  const amigos = discord.listFriends()

  if (amigos.length === 0) {
    throw Object.assign(new Error('Você não tem amigos na lista.'), { statusCode: 400 })
  }

  const task = taskManager.createTask('limpar-dm-amigos', {
    ...(cfg as unknown as Record<string, unknown>),
    totalAmigos: amigos.length,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarLimpezaDmAmigos(task.id, amigos, me, cfg).catch(() => {})

  return { taskId: task.id, totalAmigos: amigos.length }
}

async function executarLimpezaDmAmigos(
  taskId: string,
  amigos: string[],
  me: any,
  cfg: LimparDmAmigosConfig,
) {
  const startTime = Date.now()
  let totalDeletedGlobal = 0

  try {
    const client = discord.getActiveClient()

    for (let i = 0; i < amigos.length; i++) {
      if (taskManager.isAborted(taskId)) {
        taskManager.failTask(taskId, 'Cancelado pelo usuário')
        return
      }

      const idAmigo = amigos[i]

      let username = idAmigo
      let avatarUrl: string | null = null
      let dm: any = null

      try {
        const user = await client.users.fetch(idAmigo)
        username = user.globalName || user.username || idAmigo
        avatarUrl = user.displayAvatarURL?.({ dynamic: true, size: 256 }) || null
        dm = await user.createDM()
      } catch {
        logger.warn('LimparDmAmigos', `Não foi possível abrir DM com ${username}, pulando...`)
        continue
      }

      taskManager.updateProgress(
        taskId, i, amigos.length,
        `Processando DM ${i + 1}/${amigos.length}: ${username}`,
        'fetching',
        { currentDm: username, currentAvatarUrl: avatarUrl, dmIndex: i, totalDms: amigos.length },
      )

      if (cfg.fazerBackup) {
        const publicFlags = dm.recipient?.publicFlags?.bitfield ?? dm.recipient?.flags?.bitfield ?? 0
        const premiumType = dm.recipient?.premiumType ?? 0
        const badges: Badge[] = decodeBadges(publicFlags, premiumType)

        logger.info('LimparDmAmigos', `Criando backup de ${username}`)
        await backupAntesDeLimpar(dm.id, username, idAmigo, avatarUrl, badges, cfg.salvarMidiaLocal, taskId)

        if (taskManager.isAborted(taskId)) {
          taskManager.failTask(taskId, 'Cancelado pelo usuário')
          return
        }
      }

      taskManager.updateProgress(
        taskId, i, amigos.length,
        `Buscando mensagens com ${username}...`,
        'fetching',
        { currentDm: username, currentAvatarUrl: avatarUrl, dmIndex: i, totalDms: amigos.length },
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
            `${username}: ${deleted}/${messages.length} mensagens removidas (Amigo ${i + 1}/${amigos.length})`,
            'deleting',
            { currentDm: username, currentAvatarUrl: avatarUrl, dmIndex: i, totalDms: amigos.length, dmDeleted: deleted, dmTotal: messages.length },
          )

          await sleep(cfg.delay)
        }

        stats.recordCleanup({
          username,
          userId: idAmigo,
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

      logger.info('LimparDmAmigos', `DM ${i + 1}/${amigos.length} processada: ${username} (${messages.length} mensagens)`)
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    stats.recordAction('limpar-dm-amigos', duration, {
      friendsProcessed: amigos.length,
      messagesDeleted: totalDeletedGlobal,
    })

    taskManager.completeTask(taskId)
    logger.success('LimparDmAmigos', `Concluído: ${amigos.length} amigos processados, ${totalDeletedGlobal} mensagens deletadas`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('LimparDmAmigos', `Erro: ${err}`)
  }
}
