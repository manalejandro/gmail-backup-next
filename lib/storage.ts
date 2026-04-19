import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { simpleParser } from 'mailparser'
import type { EmailMeta } from './types'

// ─── Path helpers ────────────────────────────────────────────────────────────

function safeAccountDir(backupFolder: string, email: string): string {
  const sanitized = email.replace(/[^a-zA-Z0-9@._-]/g, '_')
  return path.join(backupFolder, sanitized)
}

function indexFilePath(backupFolder: string, email: string): string {
  return path.join(safeAccountDir(backupFolder, email), 'index.json')
}

function emlAbsPath(backupFolder: string, email: string, relativePath: string): string {
  const base = safeAccountDir(backupFolder, email)
  const abs = path.resolve(base, relativePath)
  // Security: prevent path traversal
  if (!abs.startsWith(base + path.sep) && abs !== base) {
    throw new Error('Path traversal attempt detected')
  }
  return abs
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>]/g, '')
    .replace(/[^a-zA-Z0-9._@-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'email'
}

// ─── Index helpers ────────────────────────────────────────────────────────────

export function getEmailIndex(backupFolder: string, account: string): EmailMeta[] {
  const p = indexFilePath(backupFolder, account)
  if (!fs.existsSync(p)) return []
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    return JSON.parse(raw) as EmailMeta[]
  } catch {
    return []
  }
}

export function uidExists(
  backupFolder: string,
  account: string,
  uid: string
): boolean {
  const idx = getEmailIndex(backupFolder, account)
  return idx.some(m => m.uid === uid)
}

/**
 * In-memory cache for the backup loop.
 * Avoids O(n²) disk I/O: without this, every email would trigger a full
 * readFileSync + JSON.parse + JSON.stringify + writeFileSync cycle on the
 * index file, blocking the Node.js event loop and pinning the CPU at 100%.
 */
export interface BackupCache {
  index: EmailMeta[]
  uidSet: Set<string>
  dirtyCount: number
}

/** Load the index once and return an in-memory cache. */
export function createBackupCache(backupFolder: string, account: string): BackupCache {
  const index = getEmailIndex(backupFolder, account)
  return { index, uidSet: new Set(index.map(m => m.uid)), dirtyCount: 0 }
}

/** Write the cached index to disk if it has unsaved changes. */
export function flushBackupCache(
  backupFolder: string,
  account: string,
  cache: BackupCache,
): void {
  if (cache.dirtyCount > 0) {
    writeIndex(backupFolder, account, cache.index)
    cache.dirtyCount = 0
  }
}

function writeIndex(backupFolder: string, account: string, index: EmailMeta[]): void {
  const p = indexFilePath(backupFolder, account)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(index, null, 2), 'utf-8')
}

// ─── Parse & save ─────────────────────────────────────────────────────────────

export async function parseAndSaveEmail(
  emlContent: string,
  uid: string,
  account: string,
  backupFolder: string,
  cache?: BackupCache,
): Promise<{ meta: EmailMeta; isNew: boolean }> {
  const parsed = await simpleParser(Buffer.from(emlContent, 'binary'))

  // Derive a stable, filesystem-safe ID from Message-ID header or content hash
  const rawId =
    parsed.messageId ??
    crypto.createHash('sha1').update(emlContent).digest('hex')
  const id = sanitizeFilename(rawId)

  const date = parsed.date ?? new Date()
  const year = date.getFullYear().toString()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')

  const relativePath = path.join(year, month, day, `${id}.eml`)
  const absPath = path.join(safeAccountDir(backupFolder, account), relativePath)

  fs.mkdirSync(path.dirname(absPath), { recursive: true })
  fs.writeFileSync(absPath, Buffer.from(emlContent, 'binary'))

  const meta: EmailMeta = {
    id,
    uid,
    subject: parsed.subject ?? '',
    from: parsed.from?.text ?? '',
    to: Array.isArray(parsed.to)
      ? parsed.to.map(a => a.text).join(', ')
      : (parsed.to?.text ?? ''),
    cc: Array.isArray(parsed.cc)
      ? parsed.cc.map(a => a.text).join(', ')
      : (parsed.cc?.text ?? undefined),
    date: date.toISOString(),
    path: relativePath,
    size: Buffer.byteLength(emlContent, 'binary'),
    hasAttachments: (parsed.attachments?.length ?? 0) > 0,
    attachments: parsed.attachments?.map(a => a.filename ?? 'unnamed') ?? [],
    read: false,
  }

  // Insert into index (sorted by date descending), skipping duplicates.
  // When a BackupCache is provided use it directly – avoids a readFileSync +
  // JSON.parse + writeFileSync on every single email (O(n²) CPU blowup).
  const idx = cache ? cache.index : getEmailIndex(backupFolder, account)
  const isDuplicate = idx.some(m => m.uid === uid)
  if (!isDuplicate) {
    idx.unshift(meta)
    // Keep the index sorted by date descending so the order is always
    // deterministic regardless of download order.
    idx.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (cache) {
      cache.uidSet.add(uid)
      cache.dirtyCount++
      // Caller is responsible for periodic + final flushBackupCache() calls
    } else {
      writeIndex(backupFolder, account, idx)
    }
  } else if (cache && !cache.uidSet.has(uid)) {
    // Index and uidSet are inconsistent (e.g. manual edit or partial flush).
    // Repair the uidSet so the backup loop won't re-download this email
    // indefinitely and never reach sessionNewCount === 0.
    cache.uidSet.add(uid)
  }

  return { meta, isNew: !isDuplicate }
}

// ─── Read email ───────────────────────────────────────────────────────────────

export function getRawEml(
  backupFolder: string,
  account: string,
  relativePath: string
): Buffer | null {
  try {
    const abs = emlAbsPath(backupFolder, account, relativePath)
    if (!fs.existsSync(abs)) return null
    return fs.readFileSync(abs)
  } catch {
    return null
  }
}

export function markAsRead(
  backupFolder: string,
  account: string,
  emailId: string
): void {
  const idx = getEmailIndex(backupFolder, account)
  const entry = idx.find(m => m.id === emailId)
  if (entry && !entry.read) {
    entry.read = true
    writeIndex(backupFolder, account, idx)
  }
}
