import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { sleep } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { stats } from '../../services/stats.service'
import type { ClonarServidorConfig } from '../../../src/types/tools'

/**
 * Retorna o MIME type baseado na extensão do arquivo de imagem
 */
function obterMimeType(extensao: string): string {
  const mimeTypes: Record<string, string> = {
    apng: 'image/apng',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
  }
  const ext = extensao.trim().toLowerCase().replace('.', '')
  return mimeTypes[ext] || 'image/png'
}

function clonarPermissoes(canalOriginal: any, cargosMap: Map<string, any>): any[] {
  const overwrites: any[] = []

  for (const overwrite of canalOriginal.permissionOverwrites.cache.values()) {
    if (overwrite.type === 'role' && cargosMap.has(overwrite.id)) {
      overwrites.push({
        id: cargosMap.get(overwrite.id).id,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield,
        type: 'role',
      })
    } else if (overwrite.type === 'member') {
      overwrites.push({
        id: overwrite.id,
        allow: overwrite.allow.bitfield,
        deny: overwrite.deny.bitfield,
        type: 'member',
      })
    }
  }

  return overwrites
}

export async function clonarServidor(cfg: ClonarServidorConfig) {
  const client = discord.getActiveClient()

  const servidorOriginal = client.guilds.cache.get(cfg.sourceGuildId)
  if (!servidorOriginal) {
    throw Object.assign(new Error('Servidor original não encontrado.'), { statusCode: 400 })
  }

  const servidorDestino = client.guilds.cache.get(cfg.targetGuildId)
  if (!servidorDestino) {
    throw Object.assign(new Error('Servidor de destino não encontrado.'), { statusCode: 400 })
  }

  const sourceGuildIcon = servidorOriginal.iconURL?.({ format: 'png', size: 128 }) || null
  const targetGuildIcon = servidorDestino.iconURL?.({ format: 'png', size: 128 }) || null

  const task = taskManager.createTask('clonar-servidor', {
    ...(cfg as unknown as Record<string, unknown>),
    sourceGuildName: servidorOriginal.name,
    targetGuildName: servidorDestino.name,
    sourceGuildIcon,
    targetGuildIcon,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarClonagem(task.id, servidorOriginal, servidorDestino, client).catch(() => {})

  return {
    taskId: task.id,
    sourceGuild: { id: servidorOriginal.id, name: servidorOriginal.name, icon: sourceGuildIcon },
    targetGuild: { id: servidorDestino.id, name: servidorDestino.name, icon: targetGuildIcon },
  }
}

async function executarClonagem(
  taskId: string,
  servidorOriginal: any,
  servidorDestino: any,
  client: any,
) {
  let errosEncontrados = 0
  const totalSteps = 12
  const startTime = Date.now()

  const updateStep = (step: number, msg: string) => {
    taskManager.updateProgress(taskId, step, totalSteps, msg, 'deleting', { step: `${step}/${totalSteps}` })
  }

  try {
    updateStep(1, 'Carregando dados do servidor...')

    try { await servidorOriginal.channels.fetch() } catch {}
    try { await servidorOriginal.roles.fetch() } catch {}
    try { await servidorOriginal.emojis.fetch() } catch {}

    if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }

    updateStep(1, 'Buscando stickers...')
    try { await servidorOriginal.stickers.fetch() } catch { errosEncontrados++ }
    const stickers = Array.from(servidorOriginal.stickers.cache, ([, value]: [any, any]) => value)

    if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }

    updateStep(2, 'Atualizando informações básicas...')
    try {
      await servidorDestino.setName(servidorOriginal.name)
      await servidorDestino.setIcon(servidorOriginal.iconURL() || null)
      if (servidorOriginal.premiumSubscriptionCount > 0) {
        await servidorDestino.setBanner(servidorOriginal.bannerURL() || null)
      }
    } catch { errosEncontrados++ }

    if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }

    updateStep(3, 'Removendo emojis existentes...')
    for (const emoji of servidorDestino.emojis.cache.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try { await emoji.delete() } catch { errosEncontrados++ }
    }

    updateStep(4, 'Removendo stickers existentes...')
    try { await servidorDestino.stickers.fetch() } catch { errosEncontrados++ }
    for (const sticker of servidorDestino.stickers.cache.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try { await sticker.delete() } catch { errosEncontrados++ }
    }

    updateStep(5, 'Removendo canais existentes...')
    for (const canal of servidorDestino.channels.cache.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try { await canal.delete() } catch { errosEncontrados++ }
    }

    updateStep(6, 'Removendo cargos existentes...')
    const cargosParaDeletar = servidorDestino.roles.cache.filter((r: any) => r.name !== '@everyone')
    for (const cargo of cargosParaDeletar.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try { await cargo.delete() } catch { errosEncontrados++ }
    }

    updateStep(7, 'Criando cargos com permissões...')
    const cargosMap = new Map<string, any>()
    const everyoneOriginal = servidorOriginal.roles.cache.find((r: any) => r.name === '@everyone')
    const everyoneDestino = servidorDestino.roles.cache.find((r: any) => r.name === '@everyone')
    if (everyoneOriginal && everyoneDestino) {
      cargosMap.set(everyoneOriginal.id, everyoneDestino)
    }

    const cargosOriginais = servidorOriginal.roles.cache
      .filter((r: any) => r.name !== '@everyone')
      .sort((a: any, b: any) => b.position - a.position)

    for (const cargo of cargosOriginais.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try {
        const novoCargo = await servidorDestino.roles.create({
          name: cargo.name,
          colors: [cargo.color || 0],
          hoist: cargo.hoist,
          mentionable: cargo.mentionable,
          permissions: cargo.permissions.bitfield,
        })
        if (novoCargo) {
          cargosMap.set(cargo.id, novoCargo)
        }
        await sleep(300)
      } catch {
        errosEncontrados++
        await sleep(1000)
      }
    }

    updateStep(8, 'Criando categorias...')
    const categoriasMap = new Map<string, any>()
    const categorias = servidorOriginal.channels.cache
      .filter((c: any) => c.type === 'GUILD_CATEGORY')
      .sort((a: any, b: any) => a.position - b.position)

    for (const categoria of categorias.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try {
        const novaCategoria = await servidorDestino.channels.create(categoria.name, {
          type: 'GUILD_CATEGORY',
          permissionOverwrites: clonarPermissoes(categoria, cargosMap),
        })
        if (novaCategoria) {
          categoriasMap.set(categoria.id, novaCategoria)
        }
        await sleep(500)
      } catch {
        errosEncontrados++
        await sleep(1000)
      }
    }

    updateStep(9, 'Criando canais de texto...')
    const canaisTexto = servidorOriginal.channels.cache
      .filter((c: any) => c.type === 'GUILD_TEXT')
      .sort((a: any, b: any) => a.position - b.position)

    for (const canal of canaisTexto.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try {
        const categoriaPai = categoriasMap.get(canal.parentId)?.id
        await servidorDestino.channels.create(canal.name, {
          type: 'GUILD_TEXT',
          parent: categoriaPai,
          topic: canal.topic || undefined,
          nsfw: canal.nsfw,
          rateLimitPerUser: canal.rateLimitPerUser,
          permissionOverwrites: clonarPermissoes(canal, cargosMap),
        })
        await sleep(500)
      } catch {
        errosEncontrados++
        await sleep(1000)
      }
    }

    updateStep(10, 'Criando canais de voz...')
    const canaisVoz = servidorOriginal.channels.cache
      .filter((c: any) => c.type === 'GUILD_VOICE')
      .sort((a: any, b: any) => a.position - b.position)

    for (const canal of canaisVoz.values()) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try {
        const categoriaPai = categoriasMap.get(canal.parentId)?.id
        await servidorDestino.channels.create(canal.name, {
          type: 'GUILD_VOICE',
          parent: categoriaPai,
          bitrate: canal.bitrate,
          userLimit: canal.userLimit,
          permissionOverwrites: clonarPermissoes(canal, cargosMap),
        })
        await sleep(500)
      } catch {
        errosEncontrados++
        await sleep(1000)
      }
    }

    updateStep(11, 'Clonando stickers...')
    for (const sticker of stickers) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try {
        const response = await fetch((sticker as any).url)
        const arrayBuffer = await response.arrayBuffer()
        const ext = (sticker as any).url.split('?')[0].split('.').pop()
        const blob = new Blob([arrayBuffer], { type: obterMimeType(ext) })

        const formData = new FormData()
        formData.append('name', (sticker as any).name)
        formData.append('tags', (sticker as any).tags || 'sticker')
        formData.append('description', (sticker as any).description || '')
        formData.append('file', blob, `sticker.${ext}`)

        const res = await fetch(`https://discord.com/api/v9/guilds/${servidorDestino.id}/stickers`, {
          method: 'POST',
          headers: { Authorization: client.token },
          body: formData,
        })

        if (!res.ok) errosEncontrados++
        await sleep(1000)
      } catch {
        errosEncontrados++
        await sleep(1000)
      }
    }

    updateStep(12, 'Clonando emojis...')
    const emojis = Array.from(servidorOriginal.emojis.cache.values())

    for (const emoji of emojis) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }
      try {
        await servidorDestino.emojis.create({
          attachment: (emoji as any).url,
          name: (emoji as any).name,
        })
        await sleep(500)
      } catch {
        errosEncontrados++
        await sleep(1000)
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    stats.recordAction('clonar-servidor', duration, {
      sourceGuild: servidorOriginal.name,
      targetGuild: servidorDestino.name,
      rolesCreated: cargosOriginais.size,
      categoriesCreated: categorias.size,
      textChannelsCreated: canaisTexto.size,
      voiceChannelsCreated: canaisVoz.size,
      stickersCloned: stickers.length,
      emojisCloned: emojis.length,
      errors: errosEncontrados,
    })

    taskManager.completeTask(taskId)
    logger.success('ClonarServidor', `Servidor clonado: ${servidorOriginal.name} → ${servidorDestino.name} (${errosEncontrados} erros)`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('ClonarServidor', `Erro durante clonagem: ${err}`)
  }
}
