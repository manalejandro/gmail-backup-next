import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getEmailIndex, getRawEml } from '@/lib/storage'
import { getSettings } from '@/lib/settings'
import { simpleParser } from 'mailparser'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; idx: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn || !session.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, idx } = await params
  const attIndex = parseInt(idx, 10)
  if (isNaN(attIndex) || attIndex < 0) {
    return NextResponse.json({ error: 'Invalid attachment index' }, { status: 400 })
  }

  const { backupFolder } = getSettings()
  const index = getEmailIndex(backupFolder, session.email)
  const meta = index.find(m => m.id === id)
  if (!meta) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const rawBuf = getRawEml(backupFolder, session.email, meta.path)
  if (!rawBuf) {
    return NextResponse.json({ error: 'EML file not found' }, { status: 404 })
  }

  const parsed = await simpleParser(rawBuf)
  const attachment = parsed.attachments?.[attIndex]
  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  const rawFilename = attachment.filename ?? `attachment-${attIndex}`
  // Strip characters unsafe for Content-Disposition
  const safeFilename = rawFilename.replace(/[^\w.\- ]/g, '_')

  return new NextResponse(new Uint8Array(attachment.content), {
    headers: {
      'Content-Type': attachment.contentType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': String(attachment.size ?? attachment.content.byteLength),
    },
  })
}
