import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { wsManager } from '../../core/websocket'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { stats } from '../../services/stats.service'
import type { CallUtilsConfig } from '../../../src/types/tools'

interface ActiveCallTask {
  taskId: string
  type: string
  cleanup: () => Promise<void>
  toggleMute?: (mute: boolean) => void
  toggleDeaf?: (deaf: boolean) => void
}

const activeCallTasks = new Map<string, ActiveCallTask>()

export function getActiveCallTasks() {
  return Array.from(activeCallTasks.entries()).map(([id, t]) => ({
    id,
    taskId: t.taskId,
    type: t.type,
  }))
}

export async function stopCallTask(taskId: string) {
  for (const [id, t] of activeCallTasks) {
    if (t.taskId === taskId) {
      await t.cleanup()
      activeCallTasks.delete(id)
      return true
    }
  }
  return false
}

export async function toggleMuteCallTask(taskId: string, mute: boolean) {
  for (const [, t] of activeCallTasks) {
    if (t.taskId === taskId && t.toggleMute) {
      t.toggleMute(mute)
      return true
    }
  }
  return false
}

export async function toggleDeafCallTask(taskId: string, deaf: boolean) {
  for (const [, t] of activeCallTasks) {
    if (t.taskId === taskId && t.toggleDeaf) {
      t.toggleDeaf(deaf)
      return true
    }
  }
  return false
}

/**
 * Executa utilitários de chamada: desconectar todos, mover membros,
 * entrar em call, tocar som, etc.
 */
export async function callUtils(cfg: CallUtilsConfig) {
  const client = discord.getActiveClient()

  switch (cfg.action) {
    case 'disconnect-all':
      return await desconectarTodos(client, cfg)
    case 'move-members':
      return await moverMembros(client, cfg)
    case 'farm-hours':
      return await farmarHoras(client, cfg)
    case 'mute-all':
      return await mutarTodos(client, cfg, true)
    case 'unmute-all':
      return await mutarTodos(client, cfg, false)
    case 'deafen-all':
      return await ensurdecerTodos(client, cfg, true)
    case 'undeafen-all':
      return await ensurdecerTodos(client, cfg, false)
    case 'list-members':
      return await listarMembros(client, cfg)
    case 'elevator':
      return await elevador(client, cfg)
    case 'leash':
      return await coleira(client, cfg)
    case 'protect':
      return await protegerUsuario(client, cfg)
    default:
      throw Object.assign(new Error('Ação inválida'), { statusCode: 400 })
  }
}

async function desconectarTodos(client: any, cfg: CallUtilsConfig) {
  if (!cfg.channelId) throw Object.assign(new Error('channelId é obrigatório'), { statusCode: 400 })

  const canal = client.channels.cache.get(cfg.channelId)
  if (!canal || canal.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de voz não encontrado'), { statusCode: 400 })
  }

  if (!canal.members.size) {
    throw Object.assign(new Error('A call está vazia'), { statusCode: 400 })
  }

  let desconectados = 0
  const total = canal.members.size

  for (const member of canal.members.values()) {
    try {
      await (member as any).voice.setChannel(null)
      desconectados++
    } catch (err: any) {
      if (err.message === 'Missing Permissions') {
        throw Object.assign(new Error('Sem permissão para desconectar membros'), { statusCode: 403 })
      }
    }
  }

  stats.recordAction('call-utils', 0, { action: 'disconnect-all', membersAffected: desconectados, channel: canal.name })
  logger.success('CallUtils', `${desconectados} membros desconectados de ${canal.name}`)
  return { desconectados, total }
}

async function moverMembros(client: any, cfg: CallUtilsConfig) {
  if (!cfg.sourceChannelId || !cfg.targetChannelId) {
    throw Object.assign(new Error('sourceChannelId e targetChannelId são obrigatórios'), { statusCode: 400 })
  }

  const canalOrigem = client.channels.cache.get(cfg.sourceChannelId)
  const canalDestino = client.channels.cache.get(cfg.targetChannelId)

  if (!canalOrigem || canalOrigem.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de origem não encontrado'), { statusCode: 400 })
  }
  if (!canalDestino || canalDestino.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de destino não encontrado'), { statusCode: 400 })
  }
  if (!canalOrigem.members.size) {
    throw Object.assign(new Error('A call de origem está vazia'), { statusCode: 400 })
  }

  let movidos = 0
  for (const member of canalOrigem.members.values()) {
    try {
      await (member as any).voice.setChannel(canalDestino.id)
      if ((member as any).id !== client.user.id) movidos++
    } catch (err: any) {
      if (err.message === 'Missing Permissions') {
        throw Object.assign(new Error('Sem permissão para mover membros'), { statusCode: 403 })
      }
    }
  }

  stats.recordAction('call-utils', 0, { action: 'move-members', membersAffected: movidos, source: canalOrigem.name, target: canalDestino.name })
  logger.success('CallUtils', `${movidos} membros movidos de ${canalOrigem.name} para ${canalDestino.name}`)
  return { movidos, origem: canalOrigem.name, destino: canalDestino.name }
}

async function mutarTodos(client: any, cfg: CallUtilsConfig, mutar: boolean) {
  if (!cfg.channelId) throw Object.assign(new Error('channelId é obrigatório'), { statusCode: 400 })

  const canal = client.channels.cache.get(cfg.channelId)
  if (!canal || canal.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de voz não encontrado'), { statusCode: 400 })
  }
  if (!canal.members.size) {
    throw Object.assign(new Error('A call está vazia'), { statusCode: 400 })
  }

  let afetados = 0
  for (const member of canal.members.values()) {
    try {
      await (member as any).voice.setMute(mutar)
      afetados++
    } catch (err: any) {
      if (err.message === 'Missing Permissions') {
        throw Object.assign(new Error('Sem permissão para mutar/desmutar membros'), { statusCode: 403 })
      }
    }
  }

  stats.recordAction('call-utils', 0, { action: mutar ? 'mute-all' : 'unmute-all', membersAffected: afetados, channel: canal.name })
  logger.success('CallUtils', `${afetados} membros ${mutar ? 'mutados' : 'desmutados'} em ${canal.name}`)
  return { afetados, action: mutar ? 'muted' : 'unmuted' }
}

async function ensurdecerTodos(client: any, cfg: CallUtilsConfig, ensurdecer: boolean) {
  if (!cfg.channelId) throw Object.assign(new Error('channelId é obrigatório'), { statusCode: 400 })

  const canal = client.channels.cache.get(cfg.channelId)
  if (!canal || canal.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de voz não encontrado'), { statusCode: 400 })
  }
  if (!canal.members.size) {
    throw Object.assign(new Error('A call está vazia'), { statusCode: 400 })
  }

  let afetados = 0
  for (const member of canal.members.values()) {
    try {
      await (member as any).voice.setDeaf(ensurdecer)
      afetados++
    } catch (err: any) {
      if (err.message === 'Missing Permissions') {
        throw Object.assign(new Error('Sem permissão para ensurdecer/desensurdecer membros'), { statusCode: 403 })
      }
    }
  }

  stats.recordAction('call-utils', 0, { action: ensurdecer ? 'deafen-all' : 'undeafen-all', membersAffected: afetados, channel: canal.name })
  logger.success('CallUtils', `${afetados} membros ${ensurdecer ? 'ensurdecidos' : 'desensurdecidos'} em ${canal.name}`)
  return { afetados, action: ensurdecer ? 'deafened' : 'undeafened' }
}

async function listarMembros(client: any, cfg: CallUtilsConfig) {
  if (!cfg.channelId) throw Object.assign(new Error('channelId é obrigatório'), { statusCode: 400 })

  const canal = client.channels.cache.get(cfg.channelId)
  if (!canal || canal.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de voz não encontrado'), { statusCode: 400 })
  }

  const membros = Array.from(canal.members.values()).map((member: any) => ({
    id: member.id,
    username: member.user.username,
    tag: member.user.tag,
    mute: member.voice.mute,
    deaf: member.voice.deaf,
    streaming: member.voice.streaming,
    selfVideo: member.voice.selfVideo,
  }))

  return {
    channel: canal.name,
    totalMembers: membros.length,
    members: membros,
  }
}

async function farmarHoras(client: any, cfg: CallUtilsConfig) {
  if (!cfg.channelId) throw Object.assign(new Error('channelId é obrigatório'), { statusCode: 400 })

  const canal = client.channels.cache.get(cfg.channelId)
  if (!canal || canal.type !== 'GUILD_VOICE') {
    throw Object.assign(new Error('Canal de voz não encontrado'), { statusCode: 400 })
  }

  if (!canal.permissionsFor(canal.guild.members.me).has('CONNECT')) {
    throw Object.assign(new Error('Sem permissão para entrar na call'), { statusCode: 403 })
  }

  const guildIcon = canal.guild?.iconURL?.({ format: 'png', size: 128 }) || null
  const selfMute = cfg.selfMute ?? false
  const selfDeaf = cfg.selfDeaf ?? false
  const guildId = canal.guild.id

  const task = taskManager.createTask('call-utils', {
    ...(cfg as unknown as Record<string, unknown>),
    subAction: 'farm-hours',
    channelName: canal.name,
    guildName: canal.guild?.name,
    guildId,
    guildIcon,
    selfMute,
    selfDeaf,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  let deveContinuar = true
  const iniciou = Date.now()
  let isMuted = selfMute
  let isDeaf = selfDeaf

  const entrarViaGateway = () => {
    client.ws.broadcast({
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: cfg.channelId,
        self_mute: isMuted,
        self_deaf: isDeaf,
        self_video: false,
      },
    })
  }

  const sairViaGateway = () => {
    client.ws.broadcast({
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      },
    })
  }

  entrarViaGateway()

  const broadcastMembers = () => {
    const ch = client.channels.cache.get(cfg.channelId)
    if (!ch) return
    for (const [memberId, member] of ch.members) {
      if (memberId === client.user.id) continue
      wsManager.broadcast('audio:speaking', {
        taskId: task.id,
        userId: memberId,
        username: (member as any).user?.username || 'Desconhecido',
        avatar: (member as any).user?.displayAvatarURL?.({ format: 'png', size: 64 }) || null,
        speaking: true,
      })
    }
  }
  setTimeout(() => { if (deveContinuar) broadcastMembers() }, 2000)

  const toggleMute = (mute: boolean) => {
    isMuted = mute
    client.ws.broadcast({
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: cfg.channelId,
        self_mute: mute,
        self_deaf: isDeaf,
        self_video: false,
      },
    })
  }

  const toggleDeaf = (deaf: boolean) => {
    isDeaf = deaf
    client.ws.broadcast({
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: cfg.channelId,
        self_mute: isMuted,
        self_deaf: deaf,
        self_video: false,
      },
    })
  }

  const cleanup = async () => {
    deveContinuar = false
    if (voiceListener) client.off('voiceStateUpdate', voiceListener)
    if (intervalId) clearInterval(intervalId)
    sairViaGateway()
    const farmDuration = Math.floor((Date.now() - iniciou) / 1000)
    stats.recordAction('call-utils', farmDuration, { action: 'farm-hours', channel: canal.name })
    if (!taskManager.isAborted(task.id)) {
      taskManager.completeTask(task.id)
    }
    activeCallTasks.delete(`farm-${cfg.channelId}`)
    logger.info('CallUtils', `Farmagem encerrada em ${canal.name}`)
  }

  const voiceListener = async (oldState: any, newState: any) => {
    if (!deveContinuar) return
    if (!oldState.member || !newState.member) return

    if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
      await sleep(2000)
      if (deveContinuar) entrarViaGateway()
      return
    }

    if (newState.channelId === cfg.channelId && oldState.channelId !== cfg.channelId && newState.member?.id !== client.user.id) {
      wsManager.broadcast('audio:speaking', {
        taskId: task.id,
        userId: newState.member.id,
        username: newState.member.user?.username || 'Desconhecido',
        avatar: newState.member.user?.displayAvatarURL?.({ format: 'png', size: 64 }) || null,
        speaking: true,
      })
    }

    if (oldState.channelId === cfg.channelId && newState.channelId !== cfg.channelId && oldState.member?.id !== client.user.id) {
      wsManager.broadcast('audio:speaking', {
        taskId: task.id,
        userId: oldState.member.id,
        username: oldState.member.user?.username || 'Desconhecido',
        avatar: oldState.member.user?.displayAvatarURL?.({ format: 'png', size: 64 }) || null,
        speaking: false,
      })
    }
  }

  client.on('voiceStateUpdate', voiceListener)

  taskManager.updateProgress(task.id, 0, 0, `Farmando em ${canal.name}: 0h 0m 0s`)

  const intervalId = setInterval(() => {
    if (!deveContinuar) { clearInterval(intervalId); return }
    const tempo = Date.now() - iniciou
    const s = Math.floor((tempo / 1000) % 60)
    const m = Math.floor((tempo / 1000 / 60) % 60)
    const h = Math.floor(tempo / 1000 / 60 / 60)
    taskManager.updateProgress(task.id, 0, 0, `Farmando em ${canal.name}: ${h}h ${m}m ${s}s`)
  }, 5000)

  activeCallTasks.set(`farm-${cfg.channelId}`, {
    taskId: task.id,
    type: 'farm',
    cleanup,
    toggleMute,
    toggleDeaf,
  })

  logger.info('CallUtils', `Farmagem iniciada em ${canal.name} (${isMuted ? 'mutado' : 'desmutado'}, ${isDeaf ? 'surdo' : 'ouvindo'})`)
  return { taskId: task.id, channel: canal.name, guild: canal.guild?.name, guildId: canal.guild?.id, guildIcon, selfMute: isMuted, selfDeaf: isDeaf }
}

async function elevador(client: any, cfg: CallUtilsConfig) {
  if (!cfg.userIds?.length || !cfg.categoryId) {
    throw Object.assign(new Error('userIds e categoryId são obrigatórios'), { statusCode: 400 })
  }

  const userId = cfg.userIds[0]
  const categoria = client.channels.cache.get(cfg.categoryId)
  if (!categoria || categoria.type !== 'GUILD_CATEGORY') {
    throw Object.assign(new Error('Categoria não encontrada'), { statusCode: 400 })
  }

  const canaisVoz = categoria.guild.channels.cache.filter(
    (c: any) => c.type === 'GUILD_VOICE' && c.parentId === cfg.categoryId,
  )

  if (canaisVoz.size === 0) {
    throw Object.assign(new Error('Nenhum canal de voz na categoria'), { statusCode: 400 })
  }

  const membro = await categoria.guild.members.fetch(userId).catch(() => null)
  if (!membro) {
    throw Object.assign(new Error('Usuário não encontrado no servidor'), { statusCode: 400 })
  }
  if (!membro.voice.channelId) {
    throw Object.assign(new Error('Usuário não está em nenhum canal de voz'), { statusCode: 400 })
  }

  const task = taskManager.createTask('call-utils', {
    ...(cfg as unknown as Record<string, unknown>),
    subAction: 'elevator',
    username: membro.user.tag,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  let deveContinuar = true
  let movimentos = 0
  const canaisArray = Array.from(canaisVoz.values())
  let indiceAtual = 0

  const cleanup = async () => {
    deveContinuar = false
    if (intervalId) clearInterval(intervalId)
    stats.recordAction('call-utils', 0, { action: 'elevator', movements: movimentos, username: membro.user.tag })
    if (!taskManager.isAborted(task.id)) {
      taskManager.completeTask(task.id)
    }
    activeCallTasks.delete(`elevator-${userId}`)
    logger.info('CallUtils', `Elevador encerrado para ${membro.user.tag}`)
  }

  const intervalId = setInterval(async () => {
    if (!deveContinuar) { clearInterval(intervalId); return }

    try {
      const membroAtualizado = await categoria.guild.members.fetch(userId)
      if (!membroAtualizado.voice.channelId) {
        await cleanup()
        return
      }

      indiceAtual = (indiceAtual + 1) % canaisArray.length
      const proximoCanal = canaisArray[indiceAtual] as any
      await membroAtualizado.voice.setChannel(proximoCanal.id)
      movimentos++

      taskManager.updateProgress(task.id, movimentos, 0, `Elevador: ${movimentos} movimentos — ${membro.user.tag}`)
    } catch {
      await cleanup()
    }
  }, 1000)

  activeCallTasks.set(`elevator-${userId}`, { taskId: task.id, type: 'elevator', cleanup })

  logger.info('CallUtils', `Elevador iniciado para ${membro.user.tag}`)
  return { taskId: task.id, username: membro.user.tag }
}

async function coleira(client: any, cfg: CallUtilsConfig) {
  if (!cfg.userIds?.length || !cfg.guildId) {
    throw Object.assign(new Error('userIds e guildId são obrigatórios'), { statusCode: 400 })
  }

  const guild = client.guilds.cache.get(cfg.guildId)
  if (!guild) {
    throw Object.assign(new Error('Servidor não encontrado'), { statusCode: 400 })
  }

  const guildIcon = guild.iconURL?.({ format: 'png', size: 128 }) || null

  const membros: any[] = []
  for (const uid of cfg.userIds) {
    const membro = await guild.members.fetch(uid).catch(() => null)
    if (membro) membros.push(membro)
  }

  if (membros.length === 0) {
    throw Object.assign(new Error('Nenhum usuário válido encontrado'), { statusCode: 400 })
  }

  const task = taskManager.createTask('call-utils', {
    ...(cfg as unknown as Record<string, unknown>),
    subAction: 'leash',
    usernames: membros.map((m: any) => m.user.tag),
    guildName: guild.name,
    guildIcon,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  let deveContinuar = true
  const puxadasPorUsuario: Record<string, number> = {}
  membros.forEach((m: any) => { puxadasPorUsuario[m.id] = 0 })

  const cleanup = async () => {
    deveContinuar = false
    client.off('voiceStateUpdate', voiceUpdateListener)
    const totalPuxadas = Object.values(puxadasPorUsuario).reduce((a, b) => a + b, 0)
    stats.recordAction('call-utils', 0, { action: 'leash', pulls: totalPuxadas, users: membros.length })
    if (!taskManager.isAborted(task.id)) {
      taskManager.completeTask(task.id)
    }
    activeCallTasks.delete(`leash-${cfg.guildId}`)
    logger.info('CallUtils', `Coleira encerrada no servidor ${guild.name}`)
  }

  const voiceUpdateListener = async (oldState: any, newState: any) => {
    if (!deveContinuar) return
    if (!oldState.member || !newState.member) return
    if (oldState.guild.id !== guild.id && newState.guild.id !== guild.id) return

    const idsMonitorados = membros.map((m: any) => m.id)

    if (idsMonitorados.includes(newState.member.id) && oldState.channelId !== newState.channelId) {
      if (newState.guild.id !== guild.id) return

      try {
        const meuCanal = guild.members.me.voice.channelId
        if (meuCanal) {
          if (!newState.channelId || newState.channelId !== meuCanal) {
            await newState.member.voice.setChannel(meuCanal)
            puxadasPorUsuario[newState.member.id]++
            const totalPuxadas = Object.values(puxadasPorUsuario).reduce((a, b) => a + b, 0)
            taskManager.updateProgress(task.id, totalPuxadas, 0, `Coleira: ${totalPuxadas} puxadas — ${membros.length} usuários`)
          }
        }
      } catch {}
    }

    if (newState.member.id === client.user.id) {
      if (newState.guild.id === guild.id || oldState.guild.id === guild.id) {
        try {
          for (const membro of membros) {
            const membroAtualizado = await guild.members.fetch(membro.id).catch(() => null)
            if (!membroAtualizado) continue
            if (newState.channelId && newState.guild.id === guild.id) {
              if (membroAtualizado.voice.channelId !== newState.channelId) {
                await membroAtualizado.voice.setChannel(newState.channelId)
                puxadasPorUsuario[membro.id]++
              }
            }
          }
          const totalPuxadas = Object.values(puxadasPorUsuario).reduce((a, b) => a + b, 0)
          taskManager.updateProgress(task.id, totalPuxadas, 0, `Coleira: ${totalPuxadas} puxadas — ${membros.length} usuários`)
        } catch {}
      }
    }
  }

  client.on('voiceStateUpdate', voiceUpdateListener)

  activeCallTasks.set(`leash-${cfg.guildId}`, { taskId: task.id, type: 'leash', cleanup })

  logger.info('CallUtils', `Coleira ativa: ${membros.length} usuários no servidor ${guild.name}`)
  return { taskId: task.id, usernames: membros.map((m: any) => m.user.tag), guildName: guild.name, guildIcon }
}

async function protegerUsuario(client: any, cfg: CallUtilsConfig) {
  if (!cfg.userIds?.length || !cfg.guildId) {
    throw Object.assign(new Error('userIds e guildId são obrigatórios'), { statusCode: 400 })
  }

  const guild = client.guilds.cache.get(cfg.guildId)
  if (!guild) {
    throw Object.assign(new Error('Servidor não encontrado'), { statusCode: 400 })
  }

  const guildIcon = guild.iconURL?.({ format: 'png', size: 128 }) || null

  const membros: any[] = []
  for (const uid of cfg.userIds) {
    const membro = await guild.members.fetch(uid).catch(() => null)
    if (membro) membros.push(membro)
  }

  if (membros.length === 0) {
    throw Object.assign(new Error('Nenhum usuário válido encontrado'), { statusCode: 400 })
  }

  const task = taskManager.createTask('call-utils', {
    ...(cfg as unknown as Record<string, unknown>),
    subAction: 'protect',
    usernames: membros.map((m: any) => m.user.tag),
    guildName: guild.name,
    guildIcon,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  let deveContinuar = true
  const protecoesPorUsuario: Record<string, number> = {}
  membros.forEach((m: any) => { protecoesPorUsuario[m.id] = 0 })

  const cleanup = async () => {
    deveContinuar = false
    client.off('voiceStateUpdate', voiceUpdateListener)
    const totalProtecoes = Object.values(protecoesPorUsuario).reduce((a, b) => a + b, 0)
    stats.recordAction('call-utils', 0, { action: 'protect', protections: totalProtecoes, users: membros.length })
    if (!taskManager.isAborted(task.id)) {
      taskManager.completeTask(task.id)
    }
    activeCallTasks.delete(`protect-${cfg.guildId}`)
    logger.info('CallUtils', `Proteção encerrada no servidor ${guild.name}`)
  }

  const voiceUpdateListener = async (oldState: any, newState: any) => {
    if (!deveContinuar) return
    if (!oldState.member || !newState.member) return

    const idsMonitorados = membros.map((m: any) => m.id)
    if (!idsMonitorados.includes(newState.member.id)) return
    if (newState.guild.id !== guild.id) return

    try {
      let acaoRealizada = false

      if (newState.mute && !oldState.mute) {
        await newState.member.voice.setMute(false)
        protecoesPorUsuario[newState.member.id]++
        acaoRealizada = true
      }

      if (newState.deaf && !oldState.deaf) {
        await newState.member.voice.setDeaf(false)
        protecoesPorUsuario[newState.member.id]++
        acaoRealizada = true
      }

      if (newState.mute && newState.deaf && (!oldState.mute || !oldState.deaf)) {
        await newState.member.voice.setMute(false)
        await newState.member.voice.setDeaf(false)
        protecoesPorUsuario[newState.member.id] += 2
        acaoRealizada = true
      }

      if (acaoRealizada) {
        const totalProtecoes = Object.values(protecoesPorUsuario).reduce((a, b) => a + b, 0)
        taskManager.updateProgress(task.id, totalProtecoes, 0, `Proteção: ${totalProtecoes} ações — ${membros.length} usuários`)
      }
    } catch {}
  }

  client.on('voiceStateUpdate', voiceUpdateListener)

  activeCallTasks.set(`protect-${cfg.guildId}`, { taskId: task.id, type: 'protect', cleanup })

  logger.info('CallUtils', `Proteção ativa: ${membros.length} usuários no servidor ${guild.name}`)
  return { taskId: task.id, usernames: membros.map((m: any) => m.user.tag), guildName: guild.name, guildIcon }
}
