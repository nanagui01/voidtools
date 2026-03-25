import type { Badge } from '../../utils/badges'

export interface BackupMeta {
  id: string
  userId: string
  username: string
  avatarUrl: string | null
  badges: Badge[]
  totalMessages: number
  totalAttachments: number
  savedMediaLocally: boolean
  createdAt: string
  folderName: string
  jsonFile: string
  durationSeconds: number
}

export interface BackupMessage {
  id: string
  type: string
  author: {
    id: string
    username: string
    globalName: string | null
    avatarUrl: string
    bot: boolean
  }
  content: string
  createdTimestamp: number
  attachments: BackupAttachment[]
  embeds: BackupEmbed[]
  stickers: BackupSticker[]
  call?: {
    participants: string[]
    duration: number | null
  }
}

export interface BackupAttachment {
  id: string
  name: string
  url: string
  localPath?: string
  contentType: string | null
  size: number
}

export interface BackupSticker {
  id: string
  name: string
  url: string
  format: 'png' | 'apng' | 'lottie' | 'gif'
}

export interface BackupEmbed {
  type: string | null
  title: string | null
  description: string | null
  url: string | null
  color: number | null
  timestamp: string | null
  author: { name: string; url: string | null; iconUrl: string | null } | null
  footer: { text: string; iconUrl: string | null } | null
  thumbnail: { url: string; width: number | null; height: number | null } | null
  image: { url: string; width: number | null; height: number | null } | null
  video: { url: string; width: number | null; height: number | null } | null
  provider: { name: string | null; url: string | null } | null
  fields: { name: string; value: string; inline: boolean }[]
}

export interface BackupData {
  version: number
  meta: {
    userId: string
    username: string
    avatarUrl: string | null
    createdAt: string
    totalMessages: number
    totalAttachments: number
    savedMediaLocally: boolean
  }
  messages: BackupMessage[]
}
