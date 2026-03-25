import { discord } from '../../services/discord.service'
import { taskManager } from '../../services/task-manager.service'
import { sleep, chunkArray } from '../../utils/helpers'
import { logger } from '../../core/logger'
import { stats } from '../../services/stats.service'
import type { ScraperIconsConfig } from '../../../src/types/tools'

function isValidFileType(url: string, tipoArquivo: string): boolean {
  const urlLower = url.toLowerCase()
  switch (tipoArquivo) {
    case 'png/jpg':
      return urlLower.includes('.png') || urlLower.includes('.jpg') || urlLower.includes('.jpeg')
    case 'gif':
      return urlLower.includes('.gif')
    case 'todos':
      return urlLower.includes('.png') || urlLower.includes('.jpg') || urlLower.includes('.jpeg') || urlLower.includes('.gif')
    default:
      return false
  }
}

async function enviarViaWebhook(webhookUrl: string, imageUrls: string[], delay: number): Promise<void> {
  const formData = new FormData()
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i]
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const blob = new Blob([arrayBuffer])
    const extension = url.split('.').pop()?.split('?')[0] || 'png'
    formData.append(`file${i}`, blob, `image${i}.${extension}`)
  }

  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    body: formData,
  })

  if (!webhookResponse.ok) {
    throw new Error(`HTTP ${webhookResponse.status}: ${webhookResponse.statusText}`)
  }

  await sleep(delay)
}

async function enviarViaConta(canal: any, imageUrls: string[], delay: number): Promise<void> {
  await canal.send({ files: imageUrls })
  await sleep(delay)
}

/**
 * Coleta ícones/imagens de um canal e envia para um canal de destino
 */
export async function scraperIcons(cfg: ScraperIconsConfig) {
  const client = discord.getActiveClient()

  const canalOrigem = client.channels.cache.get(cfg.sourceChannelId)
  if (!canalOrigem) {
    throw Object.assign(new Error('Canal de origem não encontrado.'), { statusCode: 400 })
  }

  if (cfg.sendMethod === 'webhook' && cfg.webhookUrl) {
    try {
      new URL(cfg.webhookUrl)
      if (!cfg.webhookUrl.includes('discord.com/api/webhooks/')) {
        throw new Error('invalid')
      }
    } catch {
      throw Object.assign(new Error('URL de webhook inválida.'), { statusCode: 400 })
    }
  }

  if (cfg.sendMethod === 'channel' && cfg.targetChannelId) {
    const canalDestino = client.channels.cache.get(cfg.targetChannelId)
    if (!canalDestino) {
      throw Object.assign(new Error('Canal de destino não encontrado.'), { statusCode: 400 })
    }
  }

  const task = taskManager.createTask('scraper-icons', {
    ...(cfg as unknown as Record<string, unknown>),
  })
  const controller = taskManager.startTask(task.id)
  if (!controller) throw new Error('Falha ao iniciar task')

  executarScraper(task.id, cfg, client).catch(() => {})

  return { taskId: task.id }
}

async function executarScraper(taskId: string, cfg: ScraperIconsConfig, client: any) {
  const startTime = Date.now()
  try {
    const canalOrigem = client.channels.cache.get(cfg.sourceChannelId)

    taskManager.updateProgress(taskId, 0, 0, 'Coletando imagens...', 'fetching')

    const todasUrls: string[] = []
    let ultimoId: string | undefined

    while (true) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, 'Cancelado pelo usuário'); return }

      try {
        const fetched = await canalOrigem.messages.fetch({
          limit: 100,
          ...(ultimoId && { before: ultimoId }),
        })

        if (fetched.size === 0) break

        for (const msg of fetched.values()) {
          if ((msg as any).attachments.size > 0) {
            for (const attachment of (msg as any).attachments.values()) {
              const url = attachment.url
              if (isValidFileType(url, cfg.fileType)) {
                todasUrls.push(url)
              }
            }
          }
        }

        taskManager.updateProgress(taskId, todasUrls.length, 0, `${todasUrls.length} imagens coletadas...`, 'fetching')

        ultimoId = fetched.lastKey()
        await sleep(500)
      } catch (err) {
        taskManager.failTask(taskId, `Erro ao buscar mensagens: ${err}`)
        return
      }
    }

    if (todasUrls.length === 0) {
      taskManager.updateProgress(taskId, 0, 0, 'Nenhuma imagem encontrada', 'completed')
      taskManager.completeTask(taskId)
      return
    }

    const chunks = chunkArray(todasUrls, cfg.imagesPerMessage)
    let enviadas = 0
    let erros = 0

    const canalDestino = cfg.sendMethod === 'channel' && cfg.targetChannelId
      ? client.channels.cache.get(cfg.targetChannelId)
      : null

    taskManager.updateProgress(taskId, 0, todasUrls.length, `Enviando 0/${todasUrls.length}...`, 'deleting')

    for (let i = 0; i < chunks.length; i++) {
      if (taskManager.isAborted(taskId)) { taskManager.failTask(taskId, `Cancelado (${enviadas}/${todasUrls.length} enviadas)`); return }

      const chunk = chunks[i]

      try {
        if (cfg.sendMethod === 'webhook' && cfg.webhookUrl) {
          await enviarViaWebhook(cfg.webhookUrl, chunk, cfg.delay)
        } else if (canalDestino) {
          await enviarViaConta(canalDestino, chunk, cfg.delay)
        }
        enviadas += chunk.length
      } catch {
        erros += chunk.length
      }

      taskManager.updateProgress(
        taskId, enviadas, todasUrls.length,
        `${enviadas}/${todasUrls.length} imagens enviadas${erros > 0 ? ` (${erros} erros)` : ''}`,
        'deleting',
      )
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)
    stats.recordAction('scraper-icons', duration, {
      imagesCollected: todasUrls.length,
      imagesSent: enviadas,
      errors: erros,
    })

    taskManager.completeTask(taskId)
    logger.success('ScraperIcons', `Scraper concluído: ${enviadas}/${todasUrls.length} imagens enviadas (${erros} erros)`)
  } catch (err) {
    taskManager.failTask(taskId, String(err))
    logger.error('ScraperIcons', `Erro: ${err}`)
  }
}
