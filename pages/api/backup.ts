import type { NextApiRequest, NextApiResponse } from 'next'
import { getIronSession } from 'iron-session'
import { sessionOptions } from '@/lib/session'
import { getSettings } from '@/lib/settings'
import { parseAndSaveEmail, createBackupCache, flushBackupCache } from '@/lib/storage'
import { Pop3Client } from '@/lib/pop3-client'
import type { SessionData } from '@/lib/types'

async function runBackup(
  send: (data: Record<string, unknown>) => void,
  isCancelled: () => boolean,
  email: string,
  password: string,
  backupFolder: string,
): Promise<void> {
  let globalNewCount = 0
  let globalSkippedCount = 0
  let sessionNum = 0
  let currentPop3: Pop3Client | null = null

  // Load the index once and keep it in memory.
  // Without this every email triggers a full readFileSync + JSON.parse +
  // JSON.stringify + writeFileSync cycle – O(n²) CPU that blocks the event
  // loop and prevents any other request from being served.
  const cache = createBackupCache(backupFolder, email)

  // Flush the in-memory index to disk every FLUSH_EVERY new emails so that
  // partial progress is not lost if the connection drops mid-backup.
  const FLUSH_EVERY = 50

  try {
    while (!isCancelled()) {
      sessionNum++
      const pop3 = new Pop3Client()
      currentPop3 = pop3

      send({ type: 'connecting', message: `Connecting to Gmail POP3… (session ${sessionNum})`, session: sessionNum })
      await pop3.connect('pop.gmail.com', 995)
      await pop3.auth(email, password)

      const uidMap = await pop3.uidl()
      const sessionTotal = uidMap.size

      if (sessionTotal === 0) {
        await pop3.quit()
        currentPop3 = null
        break
      }

      send({ type: 'start', session: sessionNum, total: sessionTotal })

      let sessionNewCount = 0
      let sessionCurrent = 0

      for (const [msgNum, uid] of uidMap) {
        if (isCancelled()) break
        if (cache.uidSet.has(uid)) {
          globalSkippedCount++
          sessionCurrent++
          send({
            type: 'progress',
            session: sessionNum,
            current: sessionCurrent,
            total: sessionTotal,
            skipped: true,
            globalNew: globalNewCount,
          })
        } else {
          const emlContent = await pop3.retr(msgNum)
          if (isCancelled()) break
          const { meta, isNew } = await parseAndSaveEmail(emlContent, uid, email, backupFolder, cache)
          // Only count as new if it was not already in the index.
          // An email may be re-downloaded when the uidSet and index are
          // inconsistent (e.g. partial flush); in that case isNew=false and we
          // must not inflate sessionNewCount, which would prevent the loop from
          // ever detecting that all emails are done.
          if (isNew) {
            sessionNewCount++
            globalNewCount++
          }
          sessionCurrent++
          send({
            type: 'progress',
            session: sessionNum,
            current: sessionCurrent,
            total: sessionTotal,
            subject: meta.subject,
            skipped: false,
            globalNew: globalNewCount,
          })
          // Periodic flush so progress survives a mid-backup disconnect
          if (cache.dirtyCount >= FLUSH_EVERY) {
            flushBackupCache(backupFolder, email, cache)
          }
        }
      }

      await pop3.quit()
      currentPop3 = null

      if (isCancelled() || sessionNewCount === 0) break
    }

    if (!isCancelled()) {
      flushBackupCache(backupFolder, email, cache)
      send({ type: 'complete', newCount: globalNewCount, skippedCount: globalSkippedCount, sessions: sessionNum })
    }
  } catch (err) {
    if (!isCancelled()) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      send({ type: 'error', message })
    }
    if (currentPop3) {
      try { await currentPop3.quit() } catch { /* ignore */ }
    }
  } finally {
    // Always persist whatever was accumulated, even on cancel / error
    flushBackupCache(backupFolder, email, cache)
  }
}

export const config = {
  api: {
    // Disable automatic body parsing – this endpoint is streaming-only
    bodyParser: false,
    // SSE streams accumulate far more than 4 MB over a long backup run;
    // disable Next.js's response-size guard which is not meaningful for streaming.
    responseLimit: false,
  },
  // 0 = no timeout; backup can take many minutes depending on mailbox size
  maxDuration: 0,
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const session = await getIronSession<SessionData>(req, res, sessionOptions)
  if (!session.isLoggedIn || !session.email || !session.password) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { email, password } = session
  const { backupFolder } = getSettings()

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  // Send headers immediately so the browser opens the stream right away
  res.flushHeaders()

  // Disable Nagle's algorithm so small SSE frames aren't buffered by the TCP stack
  req.socket?.setNoDelay(true)

  let cancelled = false

  // The definitive disconnect signal: fired when the client closes the connection
  req.on('close', () => {
    cancelled = true
  })

  // Next.js applies gzip compression (via the `compression` npm package) to all
  // responses by default.  Individual res.write() calls go into the zlib buffer
  // and are NOT forwarded to the socket until the buffer fills or res.flush() is
  // called explicitly.  Small isolated writes (like keepalive events) would
  // otherwise sit in the buffer indefinitely.  This is the same pattern used by
  // Next.js's own pipe-readable.js for App Router streaming responses.
  const writeAndFlush = (chunk: string): void => {
    if (!res.writable) { cancelled = true; return }
    try {
      res.write(chunk)
      if ('flush' in res && typeof (res as unknown as { flush(): void }).flush === 'function') {
        (res as unknown as { flush(): void }).flush()
      }
    } catch {
      cancelled = true
    }
  }

  const send = (data: Record<string, unknown>) => {
    if (cancelled) return
    writeAndFlush(`data: ${JSON.stringify(data)}\n\n`)
  }

  // Send a real SSE data event every 20 s so the browser and any intermediate
  // proxy don't close an otherwise-idle connection while a large email is being
  // downloaded.  The frontend ignores events with type === 'keepalive'.
  const keepaliveTimer = setInterval(() => {
    if (cancelled) {
      clearInterval(keepaliveTimer)
      return
    }
    writeAndFlush('data: {"type":"keepalive"}\n\n')
  }, 20_000)

  try {
    await runBackup(send, () => cancelled, email, password, backupFolder)
  } finally {
    clearInterval(keepaliveTimer)
    try { res.end() } catch { /* ignore */ }
  }
}
