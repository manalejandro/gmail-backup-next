export interface EmailMeta {
  id: string         // Message-ID (used as filename)
  uid: string        // POP3 UIDL unique identifier
  subject: string
  from: string
  to: string
  cc?: string
  date: string       // ISO 8601
  path: string       // Relative to account folder: year/month/day/id.eml
  size: number       // bytes
  hasAttachments: boolean
  attachments: string[]
  read: boolean
}

export interface EmailContent extends EmailMeta {
  textBody?: string
  htmlBody?: string
  emlRaw: string
  parsedAttachments: AttachmentInfo[]
}

export interface AttachmentInfo {
  filename: string
  contentType: string
  size: number
  contentId?: string
}

export interface BackupEvent {
  type: 'connecting' | 'start' | 'progress' | 'complete' | 'error' | 'keepalive'
  message?: string
  session?: number
  sessionTotal?: number
  total?: number
  current?: number
  newCount?: number
  skippedCount?: number
  globalNew?: number
  sessions?: number
  subject?: string
  skipped?: boolean
}

export interface SessionData {
  isLoggedIn: boolean
  email?: string
  password?: string
}

export interface AppSettings {
  backupFolder: string
  language: 'en' | 'es'
}
