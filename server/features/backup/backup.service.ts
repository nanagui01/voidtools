import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import { discord } from '../../services/discord.service'
import { storage } from '../../services/storage.service'
import { taskManager } from '../../services/task-manager.service'
import { logger } from '../../core/logger'
import { sleep } from '../../utils/helpers'
import { config } from '../../config'
import { processProfileBadges, type Badge } from '../../utils/badges'
import { stats } from '../../services/stats.service'
import type { BackupMeta, BackupMessage, BackupAttachment, BackupSticker, BackupEmbed, BackupData } from './backup.types'

function getBackupsDir(): string {
  const settings = storage.getSettings()
  return settings.storage?.backupsDir || path.join(config.storage.dataPath, config.storage.backupsDir)
}

function sanitizarNome(nome: string): string {
  return nome.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
}

function formatarDataArquivo(data: Date): string {
  const d = String(data.getDate()).padStart(2, '0')
  const m = String(data.getMonth() + 1).padStart(2, '0')
  const a = data.getFullYear()
  const h = String(data.getHours()).padStart(2, '0')
  const min = String(data.getMinutes()).padStart(2, '0')
  const seg = String(data.getSeconds()).padStart(2, '0')
  return `${d}-${m}-${a}_${h}-${min}-${seg}`
}

function formatarTamanho(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0) + ' ' + sizes[i]
}

function baixarArquivo(url: string, destino: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocolo = url.startsWith('https') ? https : http
    const arquivo = fs.createWriteStream(destino)

    protocolo.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        arquivo.close()
        if (fs.existsSync(destino)) fs.unlinkSync(destino)
        return baixarArquivo(response.headers.location!, destino).then(resolve).catch(reject)
      }
      if (response.statusCode !== 200) {
        arquivo.close()
        if (fs.existsSync(destino)) fs.unlinkSync(destino)
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      response.pipe(arquivo)
      arquivo.on('finish', () => { arquivo.close(); resolve() })
    }).on('error', (err) => {
      arquivo.close()
      if (fs.existsSync(destino)) fs.unlinkSync(destino)
      reject(err)
    })
  })
}

async function buscarTodasMensagensParaBackup(
  channelId: string,
  onProgress: (total: number) => void,
  abortCheck: () => boolean,
): Promise<any[]> {
  const client = (discord as any)['activeClient']
  const channel = await client.channels.fetch(channelId)
  if (!channel) return []

  let lastId: string | undefined
  const mensagens: any[] = []

  while (true) {
    if (abortCheck()) return mensagens

    const buscadas = await channel.messages.fetch({
      limit: 100,
      ...(lastId && { before: lastId }),
    })

    if (buscadas.size === 0) break

    const arr = Array.from(buscadas.values()) as any[]
    mensagens.push(...arr)
    onProgress(mensagens.length)
    lastId = buscadas.lastKey()

    if (buscadas.size < 100) break
    await sleep(500)
  }

  return mensagens.sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp)
}

function serializarMensagem(msg: any, anexosMap: Map<string, BackupAttachment[]>): BackupMessage {
  const stickers: BackupSticker[] = []
  if (msg.stickers?.size > 0) {
    msg.stickers.forEach((s: any) => {
      const rawFormat = s.format ?? s.formatType ?? s.data?.format_type ?? 0
      const formatMap: Record<number, BackupSticker['format']> = { 1: 'png', 2: 'apng', 3: 'lottie', 4: 'gif' }
      const format = formatMap[rawFormat] || 'png'
      const url = format === 'lottie'
        ? `https://cdn.discordapp.com/stickers/${s.id}.json`
        : (s.url || `https://media.discordapp.net/stickers/${s.id}.webp?size=320`)
      stickers.push({ id: s.id, name: s.name, url, format })
    })
  }

  const embeds: BackupEmbed[] = []
  if (msg.embeds?.length > 0) {
    for (const e of msg.embeds) {
      embeds.push({
        type: e.data?.type || e.type || null,
        title: e.title || null,
        description: e.description || null,
        url: e.url || null,
        color: e.color ?? null,
        timestamp: e.timestamp || null,
        author: e.author ? {
          name: e.author.name,
          url: e.author.url || null,
          iconUrl: e.author.iconURL || e.author.icon_url || null,
        } : null,
        footer: e.footer ? {
          text: e.footer.text,
          iconUrl: e.footer.iconURL || e.footer.icon_url || null,
        } : null,
        thumbnail: e.thumbnail ? {
          url: e.thumbnail.url || e.thumbnail.proxyURL || '',
          width: e.thumbnail.width || null,
          height: e.thumbnail.height || null,
        } : null,
        image: e.image ? {
          url: e.image.url || e.image.proxyURL || '',
          width: e.image.width || null,
          height: e.image.height || null,
        } : null,
        video: e.video ? {
          url: e.video.url || e.video.proxyURL || '',
          width: e.video.width || null,
          height: e.video.height || null,
        } : null,
        provider: e.provider ? {
          name: e.provider.name || null,
          url: e.provider.url || null,
        } : null,
        fields: (e.fields || []).map((f: any) => ({
          name: f.name,
          value: f.value,
          inline: !!f.inline,
        })),
      })
    }
  }

  const isCall = msg.type === 'CALL' || msg.type === 3
  const call = isCall && msg.call ? {
    participants: Array.from(msg.call.participants?.values?.() || []).map((p: any) => typeof p === 'string' ? p : p.id || String(p)),
    duration: msg.call.endedTimestamp && msg.createdTimestamp
      ? Math.round((msg.call.endedTimestamp - msg.createdTimestamp) / 1000)
      : null,
  } : undefined

  return {
    id: msg.id,
    type: isCall ? 'CALL' : (msg.type || 'DEFAULT'),
    author: {
      id: msg.author.id,
      username: msg.author.username,
      globalName: msg.author.globalName || null,
      avatarUrl: msg.author.displayAvatarURL?.({ format: 'png', size: 128 }) || '',
      bot: !!msg.author.bot,
    },
    content: msg.content || '',
    createdTimestamp: msg.createdTimestamp,
    attachments: anexosMap.get(msg.id) || [],
    embeds,
    stickers,
    ...(call && { call }),
  }
}

async function processarAnexos(
  mensagens: any[],
  pastaAssets: string | null,
  taskId: string,
  abortCheck: () => boolean,
): Promise<{ anexosMap: Map<string, BackupAttachment[]>; totalAnexos: number }> {
  const anexosMap = new Map<string, BackupAttachment[]>()

  const todos: { msgId: string; anexo: any }[] = []
  for (const msg of mensagens) {
    if (msg.attachments?.size > 0) {
      for (const anexo of msg.attachments.values()) {
        todos.push({ msgId: msg.id, anexo })
      }
    }
  }

  const totalAnexos = todos.length
  let processados = 0

  if (totalAnexos > 0 && pastaAssets) {
    taskManager.updateProgress(
      taskId, 0, totalAnexos,
      `Preparando download de ${totalAnexos} arquivo${totalAnexos !== 1 ? 's' : ''}...`,
      'backup-media',
    )
  }

  for (const { msgId, anexo } of todos) {
    if (abortCheck()) break

    let localPath: string | undefined

    if (pastaAssets) {
      const nomeArq = `${anexo.id}_${sanitizarNome(anexo.name)}`
      const caminho = path.join(pastaAssets, nomeArq)

      taskManager.updateProgress(
        taskId, processados, totalAnexos,
        `Baixando ${anexo.name} (${formatarTamanho(anexo.size || 0)}) — ${processados + 1}/${totalAnexos}`,
        'backup-media',
      )

      try {
        await baixarArquivo(anexo.url, caminho)
        localPath = `assets/${nomeArq}`
      } catch {
      }

      await sleep(50)
    }

    processados++

    const att: BackupAttachment = {
      id: anexo.id,
      name: anexo.name,
      url: anexo.url,
      ...(localPath && { localPath }),
      contentType: anexo.contentType || null,
      size: anexo.size || 0,
    }

    const existing = anexosMap.get(msgId) || []
    existing.push(att)
    anexosMap.set(msgId, existing)
  }

  return { anexosMap, totalAnexos }
}

export interface BackupConfig {
  tokenId: string
  targetId: string
  salvarMidiaLocal: boolean
}

/**
 * Cria um backup completo de mensagens de um canal/DM com mídia opcional.
 * Gera arquivo JSON com metadados, mensagens, anexos e stickers
 */
export async function criarBackup(cfg: BackupConfig): Promise<{ taskId: string; username: string; avatarUrl: string | null; userId: string; badges: Badge[] }> {
  const client = (discord as any)['activeClient']
  const activeToken = (discord as any)['activeToken'] as string | null
  if (!client) throw Object.assign(new Error('Nenhuma conta conectada'), { statusCode: 400 })

  let userId: string
  let username: string
  let avatarUrl: string | null
  let channelId: string

  const channel = await client.channels.fetch(cfg.targetId).catch(() => null)
  if (channel?.recipient) {
    userId = channel.recipient.id
    username = channel.recipient.globalName || channel.recipient.username || 'DM'
    avatarUrl = channel.recipient.displayAvatarURL?.({ dynamic: true, size: 256 }) || null
    channelId = channel.id
  } else {
    const user = await client.users.fetch(cfg.targetId).catch(() => null)
    if (!user) throw Object.assign(new Error('ID inválido.'), { statusCode: 400 })
    userId = user.id
    username = user.globalName || user.username
    avatarUrl = user.displayAvatarURL?.({ dynamic: true, size: 256 }) || null
    const dm = await user.createDM()
    channelId = dm.id
  }

  let badges: Badge[] = []
  if (activeToken) {
    const profile = await discord.fetchUserProfile(userId, activeToken)
    if (profile) {
      badges = processProfileBadges(profile.badges, profile.premium_since, profile.premium_guild_since)
    }
  }

  const task = taskManager.createTask('backup', {
    ...(cfg as unknown as Record<string, unknown>),
    username, channelId, avatarUrl, userId, badges,
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarBackup(task.id, channelId, username, userId, avatarUrl, badges, cfg).catch(() => {})
  return { taskId: task.id, username, avatarUrl, userId, badges }
}

async function executarBackup(taskId: string, channelId: string, username: string, userId: string, avatarUrl: string | null, badges: Badge[], cfg: BackupConfig) {
  const startTime = Date.now()

  try {
    taskManager.updateProgress(taskId, 0, 0, 'Escaneando mensagens...', 'backup')

    const mensagens = await buscarTodasMensagensParaBackup(
      channelId,
      (total) => taskManager.updateProgress(taskId, total, 0, `Escaneando mensagens... ${total.toLocaleString()} encontradas`, 'backup'),
      () => taskManager.isAborted(taskId),
    )

    if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }

    if (mensagens.length === 0) {
      taskManager.updateProgress(taskId, 0, 0, 'Nenhuma mensagem encontrada', 'completed')
      taskManager.completeTask(taskId)
      return
    }

    logger.info('Backup', `${mensagens.length} mensagens encontradas com ${username}`)

    const dataBackup = new Date()
    const dataFormatada = formatarDataArquivo(dataBackup)
    const nomePasta = `${sanitizarNome(username)}_${userId}_${dataFormatada}`
    const backupsDir = getBackupsDir()
    const pastaBackup = path.join(backupsDir, nomePasta)
    fs.mkdirSync(pastaBackup, { recursive: true })

    let pastaAssets: string | null = null
    if (cfg.salvarMidiaLocal) {
      pastaAssets = path.join(pastaBackup, 'assets')
      fs.mkdirSync(pastaAssets, { recursive: true })
    }

    const { anexosMap, totalAnexos } = await processarAnexos(
      mensagens, pastaAssets, taskId, () => taskManager.isAborted(taskId),
    )

    if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }

    taskManager.updateProgress(taskId, mensagens.length, mensagens.length, 'Salvando backup...', 'backup-saving')

    const mensagensOrdenadas = [...mensagens].sort((a, b) => a.createdTimestamp - b.createdTimestamp)
    const backupMessages = mensagensOrdenadas.map(m => serializarMensagem(m, anexosMap))

    const backupData: BackupData = {
      version: 1,
      meta: {
        userId,
        username,
        avatarUrl,
        createdAt: dataBackup.toISOString(),
        totalMessages: mensagens.length,
        totalAttachments: totalAnexos,
        savedMediaLocally: cfg.salvarMidiaLocal,
      },
      messages: backupMessages,
    }

    const nomeArquivo = `backup_${sanitizarNome(username)}_${dataFormatada}.json`
    fs.writeFileSync(path.join(pastaBackup, nomeArquivo), JSON.stringify(backupData), 'utf-8')

    const meta: BackupMeta = {
      id: `bk_${Date.now().toString(36)}`,
      userId,
      username,
      avatarUrl,
      badges,
      totalMessages: mensagens.length,
      totalAttachments: totalAnexos,
      savedMediaLocally: cfg.salvarMidiaLocal,
      createdAt: dataBackup.toISOString(),
      folderName: nomePasta,
      jsonFile: nomeArquivo,
      durationSeconds: Math.floor((Date.now() - startTime) / 1000),
    }

    storage.addBackup(meta)

    stats.recordAction('backup', meta.durationSeconds, {
      username,
      userId,
      messagesBackedUp: mensagens.length,
      attachmentsDownloaded: totalAnexos,
      savedMediaLocally: cfg.salvarMidiaLocal ? 1 : 0,
    })

    taskManager.completeTask(taskId)
    logger.success('Backup', `Backup concluído: ${mensagens.length} mensagens, ${totalAnexos} anexos — ${meta.durationSeconds}s`)

  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('Backup', `Erro: ${err}`)
  }
}

export async function backupAntesDeLimpar(
  channelId: string,
  username: string,
  userId: string,
  avatarUrl: string | null,
  badges: Badge[],
  salvarMidiaLocal: boolean,
  taskId: string,
): Promise<void> {
  const startTime = Date.now()

  taskManager.updateProgress(taskId, 0, 0, 'Backup: escaneando mensagens...', 'backup')

  const mensagens = await buscarTodasMensagensParaBackup(
    channelId,
    (total) => taskManager.updateProgress(taskId, total, 0, `Backup: ${total.toLocaleString()} mensagens encontradas`, 'backup'),
    () => taskManager.isAborted(taskId),
  )

  if (taskManager.isAborted(taskId) || mensagens.length === 0) return

  const dataBackup = new Date()
  const dataFormatada = formatarDataArquivo(dataBackup)
  const nomePasta = `${sanitizarNome(username)}_${userId}_${dataFormatada}`
  const backupsDir = getBackupsDir()
  const pastaBackup = path.join(backupsDir, nomePasta)
  fs.mkdirSync(pastaBackup, { recursive: true })

  let pastaAssets: string | null = null
  if (salvarMidiaLocal) {
    pastaAssets = path.join(pastaBackup, 'assets')
    fs.mkdirSync(pastaAssets, { recursive: true })
  }

  const { anexosMap, totalAnexos } = await processarAnexos(
    mensagens, pastaAssets, taskId, () => taskManager.isAborted(taskId),
  )

  if (taskManager.isAborted(taskId)) return

  taskManager.updateProgress(taskId, mensagens.length, mensagens.length, 'Backup: salvando arquivo...', 'backup-saving')

  const mensagensOrdenadas = [...mensagens].sort((a, b) => a.createdTimestamp - b.createdTimestamp)
  const backupMessages = mensagensOrdenadas.map(m => serializarMensagem(m, anexosMap))

  const backupData: BackupData = {
    version: 1,
    meta: {
      userId,
      username,
      avatarUrl,
      createdAt: dataBackup.toISOString(),
      totalMessages: mensagens.length,
      totalAttachments: totalAnexos,
      savedMediaLocally: salvarMidiaLocal,
    },
    messages: backupMessages,
  }

  const nomeArquivo = `backup_${sanitizarNome(username)}_${dataFormatada}.json`
  fs.writeFileSync(path.join(pastaBackup, nomeArquivo), JSON.stringify(backupData), 'utf-8')

  const meta: BackupMeta = {
    id: `bk_${Date.now().toString(36)}`,
    userId,
    username,
    avatarUrl,
    badges,
    totalMessages: mensagens.length,
    totalAttachments: totalAnexos,
    savedMediaLocally: salvarMidiaLocal,
    createdAt: dataBackup.toISOString(),
    folderName: nomePasta,
    jsonFile: nomeArquivo,
    durationSeconds: Math.floor((Date.now() - startTime) / 1000),
  }

  storage.addBackup(meta)
  logger.success('Backup', `Backup pré-limpeza: ${mensagens.length} mensagens com ${username}`)
}
