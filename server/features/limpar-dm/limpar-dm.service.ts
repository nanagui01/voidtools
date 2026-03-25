import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { stats } from '../../services/stats.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { decodeBadges, type Badge } from '../../utils/badges'
import { backupAntesDeLimpar } from '../backup'
import type { LimparDmConfig } from '../../../src/types/tools'

/**
 * Resolve o alvo (userId/channelId) e busca avatar e badges
 */
async function resolveTarget(targetId: string): Promise<{ channelId: string; username: string; avatarUrl: string | null; userId: string; badges: Badge[] }> {
  const client = (discord as any)['activeClient']
  const activeToken = (discord as any)['activeToken'] as string | null
  if (!client) throw Object.assign(new Error('Nenhuma conta conectada'), { statusCode: 400 })

  let userId: string
  let username: string
  let avatarUrl: string | null
  let channelId: string

  const channel = await client.channels.fetch(targetId).catch(() => null)
  if (channel && channel.recipient) {
    const user = channel.recipient
    userId = user.id
    username = user.globalName || user.username || 'DM'
    avatarUrl = user.displayAvatarURL?.({ dynamic: true, size: 256 }) || null
    channelId = channel.id
  } else {
    const user = await client.users.fetch(targetId).catch(() => null)
    if (!user) {
      throw Object.assign(new Error('ID inválido. Não é um canal nem um usuário válido.'), { statusCode: 400 })
    }
    userId = user.id
    username = user.globalName || user.username
    avatarUrl = user.displayAvatarURL?.({ dynamic: true, size: 256 }) || null
    const dm = await user.createDM()
    channelId = dm.id
  }

  const user = channel?.recipient || await client.users.fetch(userId).catch(() => null)
  const publicFlags = user?.publicFlags?.bitfield ?? user?.flags?.bitfield ?? 0
  const premiumType = user?.premiumType ?? 0
  const badges: Badge[] = decodeBadges(publicFlags, premiumType)

  return { channelId, username, avatarUrl, userId, badges }
}

/**
 * Limpa mensagens do usuário em uma DM ou canal específico.
 * Suporta backup prévio automático e delay configurável
 */
export async function limparDm(cfg: LimparDmConfig) {
  const { channelId, username, avatarUrl, userId, badges } = await resolveTarget(cfg.targetId)

  const task = taskManager.createTask('limpar-dm', {
    ...(cfg as unknown as Record<string, unknown>),
    username,
    channelId,
    avatarUrl,
    userId,
    badges,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarLimpeza(task.id, channelId, username, userId, avatarUrl, badges, cfg).catch(() => {})

  return { taskId: task.id, username, avatarUrl, userId, badges }
}

async function executarLimpeza(taskId: string, channelId: string, username: string, userId: string, avatarUrl: string | null, badges: Badge[], cfg: LimparDmConfig) {
  const startTime = Date.now()

  try {
    if (cfg.fazerBackup) {
      logger.info('LimparDM', `Criando backup antes de limpar com ${username}`)
      await backupAntesDeLimpar(channelId, username, userId, avatarUrl, badges, cfg.salvarMidiaLocal, taskId)
      if (taskManager.isAborted(taskId)) {
        taskManager.failTask(taskId, 'Cancelado pelo usuário')
        return
      }
    }

    const client = (discord as any)['activeClient']
    const me = discord.getMe()
    const channel = await client.channels.fetch(channelId)

    taskManager.updateProgress(taskId, 0, 0, 'Iniciando busca...', 'fetching')

    const messages: any[] = []
    let lastId: string | undefined
    let totalScanned = 0

    while (true) {
      if (taskManager.isAborted(taskId)) {
        taskManager.failTask(taskId, 'Cancelado pelo usuário')
        return
      }

      const fetched = await channel.messages.fetch({
        limit: 100,
        ...(lastId && { before: lastId }),
      })

      if (fetched.size === 0) break

      totalScanned += fetched.size
      const msgs = Array.from(fetched.values()) as any[]
      const own = msgs.filter((m: any) => m.author.id === me.id && !m.system)
      messages.push(...own)

      taskManager.updateProgress(
        taskId,
        messages.length,
        totalScanned,
        `${messages.length} mensagens encontradas`,
        'fetching'
      )

      lastId = fetched.lastKey()
      if (fetched.size < 100) break
      await sleep(400)
    }

    if (taskManager.isAborted(taskId)) {
      taskManager.failTask(taskId, 'Cancelado pelo usuário')
      return
    }

    if (messages.length === 0) {
      taskManager.updateProgress(taskId, 0, 0, 'Nenhuma mensagem encontrada', 'completed')
      stats.recordCleanup({ username, userId, avatarUrl, messagesDeleted: 0, messagesScanned: totalScanned, duration: Math.floor((Date.now() - startTime) / 1000), backup: !!cfg.fazerBackup })
      taskManager.completeTask(taskId)
      return
    }

    const total = messages.length
    let deleted = 0

    taskManager.updateProgress(taskId, 0, total, `0/${total}`, 'deleting')

    for (const msg of messages) {
      if (taskManager.isAborted(taskId)) {
        taskManager.failTask(taskId, `Cancelado (${deleted}/${total} deletadas)`)
        return
      }

      try {
        await msg.delete()
      } catch (err) {
        logger.warn('LimparDM', `Erro ao deletar ${msg.id}: ${err}`)
      }

      deleted++
      taskManager.updateProgress(taskId, deleted, total, `${deleted}/${total}`, 'deleting')
      await sleep(cfg.delay)
    }

    stats.recordCleanup({ username, userId, avatarUrl, messagesDeleted: deleted, messagesScanned: total, duration: Math.floor((Date.now() - startTime) / 1000), backup: !!cfg.fazerBackup })
    taskManager.completeTask(taskId)
    logger.success('LimparDM', `${deleted} mensagens deletadas com ${username}`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('LimparDM', `Erro: ${err}`)
  }
}
