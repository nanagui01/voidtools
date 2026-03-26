
export interface MonitoringToken {
  id: string
  token: string
  userId: string
  username: string
  avatar: string | null
  avatarUrl?: string
  status: 'connecting' | 'connected' | 'disconnected' | 'error'
  guildCount?: number
  addedAt: string
  lastConnectedAt?: string
}

export interface MonitoredUser {
  id: string
  userId: string
  username: string
  globalName?: string | null
  avatar: string | null
  avatarUrl?: string
  addedAt: string
  isOnline: boolean
  lastSeen?: string
  currentVoiceChannel?: {
    channelId: string
    channelName: string
    guildId: string
    guildName: string
    guildIcon: string | null
  } | null
}

export type VoiceEventType =
  | 'join'
  | 'leave'
  | 'move'
  | 'camera_on'
  | 'camera_off'
  | 'screen_on'
  | 'screen_off'
  | 'mute'
  | 'unmute'
  | 'deaf'
  | 'undeaf'
  | 'server_mute'
  | 'server_unmute'
  | 'server_deaf'
  | 'server_undeaf'

export interface VoiceEvent {
  id: string
  userId: string
  username: string
  avatarUrl?: string | null
  globalName?: string | null
  type: VoiceEventType
  timestamp: string
  channelId: string
  channelName: string
  guildId: string
  guildName: string
  guildIcon: string | null
}

export interface CallParticipant {
  userId: string
  username: string
  avatar: string | null
  avatarUrl?: string
  globalName?: string | null
  joinedAt: string
  leftAt?: string
  totalTime: number
  cameraTime?: number
  screenTime?: number
  events: VoiceEvent[]
}

export interface CallSession {
  id: string
  userId: string
  username: string
  channelId: string
  channelName: string
  guildId: string
  guildName: string
  guildIcon: string | null
  startedAt: string
  endedAt?: string
  totalDuration: number
  participants: CallParticipant[]
  events: VoiceEvent[]
  active: boolean
}

export interface MonitoringConfig {
  tokens: MonitoringToken[]
  users: MonitoredUser[]
}

export interface MonitoredAttachment {
  id: string
  filename: string
  url: string
  proxyUrl?: string
  localPath?: string
  contentType: string
  size: number
  width?: number
  height?: number
}

export type MessageEventType = 'create' | 'delete' | 'edit'

export interface MonitoredMessage {
  id: string
  messageId: string
  userId: string
  username: string
  content: string
  channelId: string
  channelName: string
  guildId: string
  guildName: string
  guildIcon: string | null
  timestamp: string
  attachments: MonitoredAttachment[]
  mentionedUserIds: string[]
  isMention: boolean
  mentionedBy?: string
  mentionedByUsername?: string
  isVoiceMessage: boolean
  voiceDuration?: number
  deleted: boolean
  deletedAt?: string
  editedAt?: string
  originalContent?: string
  sticker?: { id: string; name: string } | null
  embeds: number
  replyTo?: string
  eventType: MessageEventType
}

export interface MediaItem {
  id: string
  messageId: string
  userId: string
  username: string
  channelId: string
  channelName: string
  guildId: string
  guildName: string
  guildIcon: string | null
  timestamp: string
  attachment: MonitoredAttachment
  type: 'image' | 'video' | 'audio' | 'document'
}

export interface UserMonitoringStats {
  totalMessages: number
  totalDeleted: number
  totalMentions: number
  totalMedia: number
  totalImages: number
  totalVideos: number
  totalAudios: number
  totalDocuments: number
  totalCalls: number
  totalCallTime: number
  avgCallDuration: number
  uniqueParticipants: number
  totalServers: number
}

export interface DailyCallStat {
  date: string
  totalTime: number
  count: number
}

export interface InteractionUser {
  userId: string
  username: string
  avatar: string | null
  avatarUrl?: string
  messageCount: number
  callTime: number
  mentionCount: number
}

export interface ChannelActivity {
  channelId: string
  channelName: string
  guildName: string
  messageCount: number
  callTime: number
}

export interface MonitoringUpdate {
  type: 'voice_event' | 'presence_update' | 'session_start' | 'session_end' | 'token_status' | 'message' | 'message_delete' | 'media'
  userId?: string
  data: VoiceEvent | CallSession | MonitoringToken | MonitoredUser | MonitoredMessage | MediaItem
}

export interface MonitoringLogEntry {
  id: string
  userId: string
  username: string
  type: VoiceEventType
  timestamp: string
  channelId: string
  channelName: string
  guildId: string
  guildName: string
  details?: string
}
