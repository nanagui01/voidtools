import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { stats } from '../../services/stats.service'
import type { PrefixCommandsConfig } from '../../../src/types/tools'

interface ComandosAtivos {
  cl: boolean
  clTaskId: string | null
  mic: Map<string, boolean>
  mute: Map<string, boolean>
  muteall: Map<string, boolean>
  block: Map<string, boolean>
  blockall: Map<string, boolean>
  silence: Map<string, boolean>
  coleira: Map<string, boolean>
  coleiraIntervalos: Map<string, ReturnType<typeof setInterval>>
  coleiraTaskIds: Map<string, string>
  proteger: Set<string>
  protegerTaskIds: Map<string, string>
  apelido: Map<string, string>
  apelidoIntervalos: Map<string, ReturnType<typeof setInterval>>
  apelidoTaskIds: Map<string, string>
  elevador: Map<string, boolean>
  elevadorIntervalos: Map<string, ReturnType<typeof setInterval>>
  elevadorTaskIds: Map<string, string>
  stalkear: Map<string, boolean>
  stalkearIntervalos: Map<string, ReturnType<typeof setInterval>>
  stalkearTaskIds: Map<string, string>
  farm: { parar: () => Promise<void>; canal: any; iniciou: number } | null
  farmTaskId: string | null
}

let prefix = ';'
let messageListener: ((message: any) => Promise<void>) | null = null
let comandosAtivos: ComandosAtivos = criarComandosAtivos()

function criarComandosAtivos(): ComandosAtivos {
  return {
    cl: false,
    clTaskId: null,
    mic: new Map(),
    mute: new Map(),
    muteall: new Map(),
    block: new Map(),
    blockall: new Map(),
    silence: new Map(),
    coleira: new Map(),
    coleiraIntervalos: new Map(),
    coleiraTaskIds: new Map(),
    proteger: new Set(),
    protegerTaskIds: new Map(),
    apelido: new Map(),
    apelidoIntervalos: new Map(),
    apelidoTaskIds: new Map(),
    elevador: new Map(),
    elevadorIntervalos: new Map(),
    elevadorTaskIds: new Map(),
    stalkear: new Map(),
    stalkearIntervalos: new Map(),
    stalkearTaskIds: new Map(),
    farm: null,
    farmTaskId: null,
  }
}

export async function stopPrefixTask(taskId: string): Promise<boolean> {
  if (comandosAtivos.clTaskId === taskId) {
    comandosAtivos.cl = false
    taskManager.completeTask(taskId)
    comandosAtivos.clTaskId = null
    return true
  }

  for (const [userId, tid] of comandosAtivos.coleiraTaskIds) {
    if (tid === taskId) {
      const intervalo = comandosAtivos.coleiraIntervalos.get(userId)
      if (intervalo) clearInterval(intervalo)
      comandosAtivos.coleira.delete(userId)
      comandosAtivos.coleiraIntervalos.delete(userId)
      comandosAtivos.coleiraTaskIds.delete(userId)
      taskManager.completeTask(taskId)
      return true
    }
  }

  for (const [userId, tid] of comandosAtivos.apelidoTaskIds) {
    if (tid === taskId) {
      const intervalo = comandosAtivos.apelidoIntervalos.get(userId)
      if (intervalo) clearInterval(intervalo)
      comandosAtivos.apelido.delete(userId)
      comandosAtivos.apelidoIntervalos.delete(userId)
      comandosAtivos.apelidoTaskIds.delete(userId)
      taskManager.completeTask(taskId)
      return true
    }
  }

  for (const [userId, tid] of comandosAtivos.protegerTaskIds) {
    if (tid === taskId) {
      comandosAtivos.proteger.delete(userId)
      comandosAtivos.protegerTaskIds.delete(userId)
      taskManager.completeTask(taskId)
      return true
    }
  }

  for (const [userId, tid] of comandosAtivos.elevadorTaskIds) {
    if (tid === taskId) {
      const intervalo = comandosAtivos.elevadorIntervalos.get(userId)
      if (intervalo) clearInterval(intervalo)
      comandosAtivos.elevador.delete(userId)
      comandosAtivos.elevadorIntervalos.delete(userId)
      comandosAtivos.elevadorTaskIds.delete(userId)
      taskManager.completeTask(taskId)
      return true
    }
  }

  for (const [userId, tid] of comandosAtivos.stalkearTaskIds) {
    if (tid === taskId) {
      const intervalo = comandosAtivos.stalkearIntervalos.get(userId)
      if (intervalo) clearInterval(intervalo)
      comandosAtivos.stalkear.delete(userId)
      comandosAtivos.stalkearIntervalos.delete(userId)
      comandosAtivos.stalkearTaskIds.delete(userId)
      taskManager.completeTask(taskId)
      return true
    }
  }

  if (comandosAtivos.farmTaskId === taskId && comandosAtivos.farm) {
    await comandosAtivos.farm.parar()
    comandosAtivos.farm = null
    comandosAtivos.farmTaskId = null
    return true
  }

  return false
}

/**
 * Gerencia comandos por prefixo no chat (cl, coleira, proteger, apelido, etc.).
 * Escuta mensagens em tempo real e executa ações automáticas
 */
export async function prefixCommands(cfg: PrefixCommandsConfig) {
  switch (cfg.action) {
    case 'enable':
      return await ativarPrefixo(cfg)
    case 'disable':
      return await desativarPrefixo()
    case 'set-prefix':
      return await setarPrefixo(cfg)
    case 'status':
      return obterStatus()
    default:
      throw Object.assign(new Error('Ação inválida'), { statusCode: 400 })
  }
}

function obterStatus() {
  const tarefasAtivas: string[] = []

  if (comandosAtivos.cl) tarefasAtivas.push('cl (deletando mensagens)')
  for (const uid of comandosAtivos.coleira.keys()) tarefasAtivas.push(`coleira: ${uid}`)
  for (const uid of comandosAtivos.proteger) tarefasAtivas.push(`proteger: ${uid}`)
  for (const uid of comandosAtivos.apelido.keys()) tarefasAtivas.push(`apelido: ${uid}`)
  for (const uid of comandosAtivos.elevador.keys()) tarefasAtivas.push(`elevador: ${uid}`)
  for (const uid of comandosAtivos.stalkear.keys()) tarefasAtivas.push(`stalkear: ${uid}`)
  if (comandosAtivos.farm) tarefasAtivas.push(`farm: ${comandosAtivos.farm.canal?.name}`)

  return {
    enabled: messageListener !== null,
    prefix,
    activeTasks: tarefasAtivas,
  }
}

async function setarPrefixo(cfg: PrefixCommandsConfig) {
  if (!cfg.prefix || cfg.prefix.length === 0) {
    throw Object.assign(new Error('Prefixo não pode estar vazio'), { statusCode: 400 })
  }
  prefix = cfg.prefix
  logger.info('PrefixCommands', `Prefixo alterado para: ${prefix}`)
  return { prefix }
}

async function ativarPrefixo(cfg: PrefixCommandsConfig) {
  if (messageListener) {
    return { enabled: true, message: 'Já está ativo' }
  }

  const client = discord.getActiveClient()

  if (cfg.prefix) prefix = cfg.prefix

  messageListener = async (message: any) => {
    let currentClient: any
    try {
      currentClient = discord.getActiveClient()
    } catch {
      return
    }

    if (message.author.id !== currentClient.user.id) return
    if (!message.content.startsWith(prefix)) return

    const args = message.content.slice(prefix.length).trim().split(/ +/)
    const comando = args.shift()!.toLowerCase()

    try {
      await executarComando(currentClient, comando, args, message)
    } catch (err: any) {
      logger.error('PrefixCommands', `Erro no comando ${comando}: ${err.message}`)
    }
  }

  client.on('messageCreate', messageListener)

  logger.success('PrefixCommands', `Sistema de prefixo ativado (prefix: ${prefix})`)
  return { enabled: true, prefix }
}

async function desativarPrefixo() {
  if (!messageListener) {
    return { enabled: false, message: 'Já está desativado' }
  }

  const client = discord.getActiveClient()
  client.off('messageCreate', messageListener)
  messageListener = null

  await pararTodosComandos(client)

  logger.info('PrefixCommands', 'Sistema de prefixo desativado')
  return { enabled: false }
}

async function executarComando(client: any, comando: string, args: string[], message: any) {
  switch (comando) {
    case 'cl':
      await deletarMensagens(client, message)
      break
    case 'stop':
      await pararDeletarMensagens(message)
      break
    case 'stopall':
    case 'clearall':
      await pararTodosComandos(client, message)
      break
    case 'mic':
    case 'rmic':
      await mutarMic(client, args[0], message, comando === 'rmic')
      break
    case 'mute':
    case 'rmute':
      await mutarUsuario(args[0], message, false, comando === 'rmute')
      break
    case 'muteall':
    case 'rmuteall':
      await mutarUsuario(args[0], message, true, comando === 'rmuteall')
      break
    case 'block':
    case 'rblock':
      await bloquearUsuario(client, args[0], message, false, comando === 'rblock')
      break
    case 'blockall':
    case 'rblockall':
      await bloquearUsuario(client, args[0], message, true, comando === 'rblockall')
      break
    case 'silence':
    case 'rsilence':
      await silenciarCall(client, message, comando === 'rsilence')
      break
    case 'coleira':
    case 'rcoleira':
      await moverParaCall(client, args[0], message, comando === 'rcoleira')
      break
    case 'proteger':
    case 'rproteger':
      await protegerUsuario(client, args[0], message, comando === 'rproteger')
      break
    case 'apelido':
    case 'rapelido':
      await mudarApelido(args[0], args.slice(1).join(' '), message, comando === 'rapelido')
      break
    case 'elevador':
    case 'relevador':
      await elevadorCalls(client, args[0], message, comando === 'relevador')
      break
    case 'stalkear':
    case 'rstalkear':
      await stalkearUsuario(client, args[0], message, comando === 'rstalkear')
      break
    case 'link':
    case 'rlink':
      await enviarLinkCall(message, comando === 'rlink')
      break
    case 'farm':
    case 'rfarm':
      await farmarHoras(client, args[0], message, comando === 'rfarm')
      break
    default:
      await message.delete().catch(() => {})
  }
}

async function deletarMensagens(client: any, message: any) {
  comandosAtivos.cl = true
  const canal = message.channel
  const nomeCanal = canal.name || 'DM'
  let contador = 0

  await message.delete().catch(() => {})

  let todasMensagens: any[] = []
  let ultimoId: string | null = null
  let deveContinuar = true

  try {
    while (deveContinuar && comandosAtivos.cl) {
      const opcoes: any = { limit: 100 }
      if (ultimoId) opcoes.before = ultimoId

      const lote = await canal.messages.fetch(opcoes)
      if (lote.size === 0) break

      const minhasMensagens = lote.filter(
        (m: any) =>
          m.author.id === client.user.id &&
          m.type === 'DEFAULT' &&
          !m.system &&
          m.deletable,
      )

      todasMensagens = todasMensagens.concat(Array.from(minhasMensagens.values()))
      ultimoId = lote.last()?.id
      if (lote.size < 100) deveContinuar = false

      await sleep(500)
    }
  } catch {}

  if (todasMensagens.length === 0) return

  const totalFiltradas = todasMensagens.length

  const task = taskManager.createTask('prefix-commands', { subAction: 'cl', canal: nomeCanal, total: totalFiltradas })
  taskManager.startTask(task.id)
  comandosAtivos.clTaskId = task.id

  for (const msg of todasMensagens) {
    if (!comandosAtivos.cl) break

    await sleep(1000)
    await msg
      .delete()
      .then(() => {
        contador++
        taskManager.updateProgress(task.id, contador, totalFiltradas, `Deletando: ${contador}/${totalFiltradas} em ${nomeCanal}`)
      })
      .catch(() => {})
  }

  comandosAtivos.cl = false
  if (comandosAtivos.clTaskId) {
    stats.recordAction('prefix-commands', 0, { action: 'cl', messagesDeleted: contador, totalFiltered: totalFiltradas, channel: nomeCanal })
    taskManager.completeTask(comandosAtivos.clTaskId)
    comandosAtivos.clTaskId = null
  }
}

async function pararDeletarMensagens(message?: any) {
  if (message) await message.delete().catch(() => {})

  comandosAtivos.cl = false
  if (comandosAtivos.clTaskId) {
    taskManager.completeTask(comandosAtivos.clTaskId)
    comandosAtivos.clTaskId = null
  }
}

async function pararTodosComandos(_client?: any, message?: any) {
  if (message) await message.delete().catch(() => {})

  if (comandosAtivos.clTaskId) await pararDeletarMensagens()

  for (const [userId, taskId] of comandosAtivos.coleiraTaskIds) {
    const intervalo = comandosAtivos.coleiraIntervalos.get(userId)
    if (intervalo) clearInterval(intervalo)
    taskManager.completeTask(taskId)
  }
  comandosAtivos.coleira.clear()
  comandosAtivos.coleiraIntervalos.clear()
  comandosAtivos.coleiraTaskIds.clear()

  for (const [userId, taskId] of comandosAtivos.apelidoTaskIds) {
    const intervalo = comandosAtivos.apelidoIntervalos.get(userId)
    if (intervalo) clearInterval(intervalo)
    taskManager.completeTask(taskId)
  }
  comandosAtivos.apelido.clear()
  comandosAtivos.apelidoIntervalos.clear()
  comandosAtivos.apelidoTaskIds.clear()

  for (const [, taskId] of comandosAtivos.protegerTaskIds) {
    taskManager.completeTask(taskId)
  }
  comandosAtivos.proteger.clear()
  comandosAtivos.protegerTaskIds.clear()

  for (const [userId, taskId] of comandosAtivos.elevadorTaskIds) {
    const intervalo = comandosAtivos.elevadorIntervalos.get(userId)
    if (intervalo) clearInterval(intervalo)
    taskManager.completeTask(taskId)
  }
  comandosAtivos.elevador.clear()
  comandosAtivos.elevadorIntervalos.clear()
  comandosAtivos.elevadorTaskIds.clear()

  for (const [, intervalo] of comandosAtivos.stalkearIntervalos) {
    clearInterval(intervalo)
  }
  for (const [, taskId] of comandosAtivos.stalkearTaskIds) {
    taskManager.completeTask(taskId)
  }
  comandosAtivos.stalkear.clear()
  comandosAtivos.stalkearIntervalos.clear()
  comandosAtivos.stalkearTaskIds.clear()

  if (comandosAtivos.farm) {
    await comandosAtivos.farm.parar()
    comandosAtivos.farm = null
    comandosAtivos.farmTaskId = null
  }

  logger.info('PrefixCommands', 'Todos os comandos parados')
}

async function mutarMic(client: any, userId: string, message: any, desmutar: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild || !message.member?.voice?.channel) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro || !membro.voice?.channel) return

  try {
    await membro.voice.setMute(!desmutar)
    logger.info('PrefixCommands', `${desmutar ? '🔊 Mic desmutado' : '🔇 Mic mutado'}: ${membro.user.tag} (${desmutar ? ';rmic' : ';mic'})`)
  } catch (err: any) {
    logger.error('PrefixCommands', `Erro ao ${desmutar ? 'desmutar' : 'mutar'} mic de ${membro.user.tag}: ${err.message}`)
  }
}

async function mutarUsuario(userId: string, message: any, _all: boolean, desmutar: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  try {
    await membro.voice.setMute(!desmutar)
    await membro.voice.setDeaf(!desmutar)
    logger.info('PrefixCommands', `${desmutar ? '🔊 Usuário desmutado+desensurdecido' : '🔇 Usuário mutado+ensurdecido'}: ${membro.user.tag} (${desmutar ? ';rmute' : ';mute'})`)
  } catch (err: any) {
    logger.error('PrefixCommands', `Erro ao ${desmutar ? 'desmutar' : 'mutar'} ${membro.user.tag}: ${err.message}`)
  }
}

async function bloquearUsuario(client: any, userId: string, message: any, _all: boolean, desbloquear: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  try {
    if (!desbloquear) {
      await membro.voice.disconnect()

      const mensagens = await message.channel.messages.fetch({ limit: 100 })
      const mensagensUsuario = mensagens.filter((m: any) => m.author.id === userId)

      for (const msg of mensagensUsuario.values()) {
        await msg.delete().catch(() => {})
        await sleep(500)
      }

      logger.info('PrefixCommands', `🚫 Bloqueado: ${membro.user.tag} — desconectado da call e mensagens deletadas (;block)`)
    } else {
      logger.info('PrefixCommands', `✅ Desbloqueado: ${membro.user.tag} (;rblock)`)
    }
  } catch (err: any) {
    logger.error('PrefixCommands', `Erro ao ${desbloquear ? 'desbloquear' : 'bloquear'} ${membro.user.tag}: ${err.message}`)
  }
}

async function silenciarCall(client: any, message: any, dessilenciar: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild || !message.member?.voice?.channel) return

  const channel = message.member.voice.channel

  try {
    for (const [, membro] of channel.members) {
      if (membro.id === client.user.id) continue
      if (!dessilenciar && comandosAtivos.proteger.has(membro.id)) continue

      await membro.voice.setMute(!dessilenciar)
    }
    logger.info('PrefixCommands', `${dessilenciar ? '🔊 Call dessilenciada' : '🔇 Call silenciada'}: ${channel.name} — ${channel.members.size} membros (${dessilenciar ? ';rsilence' : ';silence'})`)
  } catch (err: any) {
    logger.error('PrefixCommands', `Erro ao ${dessilenciar ? 'dessilenciar' : 'silenciar'} call: ${err.message}`)
  }
}

async function moverParaCall(client: any, userId: string, message: any, parar: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild || !message.member?.voice?.channel) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  if (parar) {
    comandosAtivos.coleira.delete(userId)
    const intervalo = comandosAtivos.coleiraIntervalos.get(userId)
    if (intervalo) {
      clearInterval(intervalo)
      comandosAtivos.coleiraIntervalos.delete(userId)
    }
    const taskId = comandosAtivos.coleiraTaskIds.get(userId)
    if (taskId) {
      taskManager.completeTask(taskId)
      comandosAtivos.coleiraTaskIds.delete(userId)
    }
    logger.info('PrefixCommands', `🔓 Coleira removida: ${membro.user.tag} — usuário liberado (;rcoleira)`)
    return
  }

  comandosAtivos.coleira.set(userId, true)
  const myChannel = message.member.voice.channel
  const nomeUsuario = membro.user.tag

  const task = taskManager.createTask('prefix-commands', { subAction: 'coleira', usuario: nomeUsuario, userId })
  taskManager.startTask(task.id)
  comandosAtivos.coleiraTaskIds.set(userId, task.id)
  taskManager.updateProgress(task.id, 0, 0, `Coleira: ${nomeUsuario} → ${myChannel.name}`)

  const intervalo = setInterval(async () => {
    if (!comandosAtivos.coleira.get(userId)) {
      clearInterval(intervalo)
      const tid = comandosAtivos.coleiraTaskIds.get(userId)
      if (tid) {
        taskManager.completeTask(tid)
        comandosAtivos.coleiraTaskIds.delete(userId)
      }
      return
    }

    try {
      if (membro.voice?.channel?.id !== myChannel.id) {
        await membro.voice.setChannel(myChannel)
        taskManager.updateProgress(task.id, 0, 0, `Coleira: moveu ${nomeUsuario} → ${myChannel.name}`)
      }
    } catch {}
  }, 2000)

  comandosAtivos.coleiraIntervalos.set(userId, intervalo)

  logger.info('PrefixCommands', `🔗 Coleira ativada: ${nomeUsuario} → preso em ${myChannel.name} (;coleira)`)
}

async function protegerUsuario(client: any, userId: string, message: any, desproteger: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  const nomeUsuario = membro.user.tag

  if (desproteger) {
    comandosAtivos.proteger.delete(userId)
    const taskId = comandosAtivos.protegerTaskIds.get(userId)
    if (taskId) {
      taskManager.completeTask(taskId)
      comandosAtivos.protegerTaskIds.delete(userId)
    }
    logger.info('PrefixCommands', `🛡️ Proteção removida: ${nomeUsuario} — não será mais desmutado automaticamente (;rproteger)`)
  } else {
    comandosAtivos.proteger.add(userId)

    if (membro?.voice) {
      await membro.voice.setMute(false).catch(() => {})
    }

    const task = taskManager.createTask('prefix-commands', { subAction: 'proteger', usuario: nomeUsuario, userId })
    taskManager.startTask(task.id)
    comandosAtivos.protegerTaskIds.set(userId, task.id)
    taskManager.updateProgress(task.id, 0, 0, `Protegendo: ${nomeUsuario}`)

    const voiceListener = async (_oldState: any, newState: any) => {
      if (!comandosAtivos.proteger.has(userId)) {
        client.off('voiceStateUpdate', voiceListener)
        return
      }
      if (newState.member.id !== userId) return
      if (newState.mute) await newState.member.voice.setMute(false).catch(() => {})
      if (newState.deaf) await newState.member.voice.setDeaf(false).catch(() => {})
    }

    client.on('voiceStateUpdate', voiceListener)

    logger.info('PrefixCommands', `🛡️ Proteção ativada: ${nomeUsuario} — será desmutado automaticamente ao ser mutado (;proteger)`)
  }
}

async function mudarApelido(userId: string, apelido: string, message: any, remover: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  const nomeUsuario = membro.user.tag

  if (remover) {
    const intervalo = comandosAtivos.apelidoIntervalos.get(userId)
    if (intervalo) {
      clearInterval(intervalo)
      comandosAtivos.apelidoIntervalos.delete(userId)
    }
    const taskId = comandosAtivos.apelidoTaskIds.get(userId)
    if (taskId) {
      taskManager.completeTask(taskId)
      comandosAtivos.apelidoTaskIds.delete(userId)
    }
    comandosAtivos.apelido.delete(userId)

    try {
      await membro.setNickname(null)
    } catch {}

    logger.info('PrefixCommands', `📝 Apelido removido: ${nomeUsuario} — apelido restaurado ao original (;rapelido)`)
  } else {
    comandosAtivos.apelido.set(userId, apelido)

    try {
      await membro.setNickname(apelido)
    } catch {}

    const intervalo = setInterval(async () => {
      if (!comandosAtivos.apelido.has(userId)) {
        clearInterval(intervalo)
        const tid = comandosAtivos.apelidoTaskIds.get(userId)
        if (tid) {
          taskManager.completeTask(tid)
          comandosAtivos.apelidoTaskIds.delete(userId)
        }
        return
      }

      try {
        const apelidoAtual = comandosAtivos.apelido.get(userId)
        if (membro.nickname !== apelidoAtual) {
          await membro.setNickname(apelidoAtual)
        }
      } catch {}
    }, 5000)

    comandosAtivos.apelidoIntervalos.set(userId, intervalo)

    const task = taskManager.createTask('prefix-commands', { subAction: 'apelido', usuario: nomeUsuario, userId, apelido })
    taskManager.startTask(task.id)
    comandosAtivos.apelidoTaskIds.set(userId, task.id)
    taskManager.updateProgress(task.id, 0, 0, `Apelido "${apelido}": ${nomeUsuario}`)

    logger.info('PrefixCommands', `📝 Apelido forçado: ${nomeUsuario} → "${apelido}" — será mantido automaticamente (;apelido)`)
  }
}

async function elevadorCalls(client: any, userId: string, message: any, parar: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  if (parar) {
    comandosAtivos.elevador.delete(userId)
    const intervalo = comandosAtivos.elevadorIntervalos.get(userId)
    if (intervalo) {
      clearInterval(intervalo)
      comandosAtivos.elevadorIntervalos.delete(userId)
    }
    const taskId = comandosAtivos.elevadorTaskIds.get(userId)
    if (taskId) {
      taskManager.completeTask(taskId)
      comandosAtivos.elevadorTaskIds.delete(userId)
    }
    logger.info('PrefixCommands', `🛗 Elevador parado: ${membro.user.tag} — não será mais movido entre calls (;relevador)`)
    return
  }

  comandosAtivos.elevador.set(userId, true)
  const voiceChannels = message.guild.channels.cache.filter((c: any) => c.type === 'GUILD_VOICE')
  const nomeUsuario = membro.user.tag

  const intervalo = setInterval(async () => {
    if (!comandosAtivos.elevador.get(userId)) {
      clearInterval(intervalo)
      const tid = comandosAtivos.elevadorTaskIds.get(userId)
      if (tid) {
        taskManager.completeTask(tid)
        comandosAtivos.elevadorTaskIds.delete(userId)
      }
      return
    }

    try {
      const canais = Array.from(voiceChannels.values())
      const canalAleatorio = canais[Math.floor(Math.random() * canais.length)] as any
      await membro.voice.setChannel(canalAleatorio)
    } catch {}
  }, 3000)

  comandosAtivos.elevadorIntervalos.set(userId, intervalo)

  const task = taskManager.createTask('prefix-commands', { subAction: 'elevador', usuario: nomeUsuario, userId })
  taskManager.startTask(task.id)
  comandosAtivos.elevadorTaskIds.set(userId, task.id)
  taskManager.updateProgress(task.id, 0, 0, `Elevador: movendo ${nomeUsuario} entre calls`)

  logger.info('PrefixCommands', `🛗 Elevador ativado: ${nomeUsuario} — será movido entre ${voiceChannels.size} calls aleatoriamente (;elevador)`)
}

async function stalkearUsuario(client: any, userId: string, message: any, parar: boolean) {
  await message.delete().catch(() => {})

  if (!message.guild) return

  const membro = await message.guild.members.fetch(userId).catch(() => null)
  if (!membro) return

  const nomeUsuario = membro.user.tag

  if (parar) {
    comandosAtivos.stalkear.delete(userId)
    const intervalo = comandosAtivos.stalkearIntervalos.get(userId)
    if (intervalo) {
      clearInterval(intervalo)
      comandosAtivos.stalkearIntervalos.delete(userId)
    }
    const taskId = comandosAtivos.stalkearTaskIds.get(userId)
    if (taskId) {
      taskManager.completeTask(taskId)
      comandosAtivos.stalkearTaskIds.delete(userId)
    }
    logger.info('PrefixCommands', `👁️ Stalk parado: ${nomeUsuario} — não será mais rastreado (;rstalkear)`)
    return
  }

  comandosAtivos.stalkear.set(userId, true)
  const canal = message.channel

  const task = taskManager.createTask('prefix-commands', { subAction: 'stalkear', usuario: nomeUsuario, userId })
  taskManager.startTask(task.id)
  comandosAtivos.stalkearTaskIds.set(userId, task.id)

  const intervalo = setInterval(async () => {
    if (!comandosAtivos.stalkear.get(userId)) {
      clearInterval(intervalo)
      return
    }

    try {
      if (membro.voice?.channel) {
        const link = `https://discord.com/channels/${message.guild.id}/${membro.voice.channel.id}`
        await canal.send(`${membro.user.tag} está em: ${link}`)
      }
    } catch {}
  }, 10000)

  comandosAtivos.stalkearIntervalos.set(userId, intervalo)
  taskManager.updateProgress(task.id, 0, 0, `Stalkeando: ${nomeUsuario}`)

  logger.info('PrefixCommands', `👁️ Stalk ativado: ${nomeUsuario} — localização na call será enviada a cada 10s (;stalkear)`)
}

async function enviarLinkCall(message: any, deletar: boolean) {
  if (deletar) {
    await message.delete().catch(() => {})
    return
  }

  if (!message.guild || !message.member?.voice?.channel) {
    await message.delete().catch(() => {})
    return
  }

  const link = `https://discord.com/channels/${message.guild.id}/${message.member.voice.channel.id}`
  await message.channel.send(link)
  await message.delete().catch(() => {})
}

async function farmarHoras(client: any, idCall: string, message: any, parar: boolean) {
  await message.delete().catch(() => {})

  if (parar) {
    if (comandosAtivos.farm) {
      await comandosAtivos.farm.parar()
      comandosAtivos.farm = null
    }
    if (comandosAtivos.farmTaskId) {
      taskManager.completeTask(comandosAtivos.farmTaskId)
      comandosAtivos.farmTaskId = null
    }
    logger.info('PrefixCommands', '⏹️ Farmagem parada — saiu da call (;rfarm)')
    return
  }

  if (comandosAtivos.farm) {
    await comandosAtivos.farm.parar()
    comandosAtivos.farm = null
    if (comandosAtivos.farmTaskId) {
      taskManager.completeTask(comandosAtivos.farmTaskId)
      comandosAtivos.farmTaskId = null
    }
  }

  let channelId = idCall
  if (channelId) {
    const match = channelId.match(/^<#(\d+)>$/)
    if (match) channelId = match[1]
  }

  if (!channelId) {
    const member = message.guild?.members?.cache?.get(client.user.id)
    const voiceChannel = member?.voice?.channel
    if (voiceChannel) {
      channelId = voiceChannel.id
    } else {
      logger.warn('PrefixCommands', 'Farm: nenhum canal de voz especificado e você não está em um canal de voz')
      return
    }
  }

  const canal = client.channels.cache.get(channelId)
  if (!canal || (canal.type !== 'GUILD_VOICE' && canal.type !== 'GUILD_STAGE_VOICE')) {
    logger.warn('PrefixCommands', `Farm: canal de voz não encontrado (ID: ${channelId})`)
    return
  }

  const me = canal.guild?.members?.me || canal.guild?.members?.cache?.get(client.user.id)
  if (me) {
    try {
      if (!canal.permissionsFor(me).has('CONNECT')) {
        logger.warn('PrefixCommands', `Farm: sem permissão para entrar em ${canal.name}`)
        return
      }
    } catch {
    }
  }

  let deveContinuar = true
  let voiceUpdateListener: any
  const iniciou = Date.now()
  const guildId = canal.guild.id

  const entrarViaGateway = () => {
    client.ws.broadcast({
      op: 4,
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: false,
        self_deaf: false,
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

  const nomeCanal = canal.name || 'Canal Desconhecido'
  const nomeGuild = canal.guild?.name || 'Servidor Desconhecido'

  const task = taskManager.createTask('prefix-commands', { subAction: 'farm', canal: nomeCanal, guild: nomeGuild })
  taskManager.startTask(task.id)

  const pararFarmagem = async () => {
    deveContinuar = false
    if (voiceUpdateListener) {
      client.off('voiceStateUpdate', voiceUpdateListener)
    }
    sairViaGateway()
    comandosAtivos.farm = null
    if (comandosAtivos.farmTaskId) {
      taskManager.completeTask(comandosAtivos.farmTaskId)
      comandosAtivos.farmTaskId = null
    }
  }

  voiceUpdateListener = async (oldState: any, newState: any) => {
    if (!deveContinuar) return
    if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
      await sleep(2000)
      if (deveContinuar) entrarViaGateway()
    }
  }

  client.on('voiceStateUpdate', voiceUpdateListener)

  comandosAtivos.farm = { parar: pararFarmagem, canal, iniciou }
  comandosAtivos.farmTaskId = task.id

  const intervalTempo = setInterval(() => {
    if (!deveContinuar) {
      clearInterval(intervalTempo)
      return
    }
    const tempo = Date.now() - iniciou
    const s = Math.floor((tempo / 1000) % 60)
    const m = Math.floor((tempo / 1000 / 60) % 60)
    const h = Math.floor(tempo / 1000 / 60 / 60)
    taskManager.updateProgress(task.id, 0, 0, `Farmando em ${nomeCanal}: ${h}h ${m}m ${s}s`)
  }, 5000)

  taskManager.updateProgress(task.id, 0, 0, `Farmando em ${nomeCanal}: 0h 0m 0s`)

  logger.info('PrefixCommands', `⏰ Farmagem iniciada — entrou em ${nomeCanal} (${nomeGuild}) para farmar horas (;farm)`)
}
