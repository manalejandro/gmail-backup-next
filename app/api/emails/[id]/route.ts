import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getEmailIndex, getRawEml, markAsRead } from '@/lib/storage'
import { getSettings } from '@/lib/settings'
import { simpleParser } from 'mailparser'
import sanitizeHtml from 'sanitize-html'

const SANITIZE_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img', 'font', 'center', 'table', 'tbody', 'thead', 'tfoot',
    'tr', 'td', 'th', 'caption', 'col', 'colgroup', 'span', 'div',
  ],
  allowedAttributes: {
    '*': ['class', 'style', 'id', 'align', 'valign', 'bgcolor', 'color', 'width', 'height', 'border'],
    'a': ['href', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height'],
    'td': ['colspan', 'rowspan'],
    'th': ['colspan', 'rowspan'],
    'table': ['cellpadding', 'cellspacing', 'border', 'width'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'cid'],
  transformTags: {
    a: (_tag, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.isLoggedIn || !session.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
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

  const htmlBody = parsed.html
    ? sanitizeHtml(parsed.html, SANITIZE_CONFIG)
    : null
  const textBody = parsed.text ?? null

  const attachments = parsed.attachments?.map(a => ({
    filename: a.filename ?? 'unnamed',
    contentType: a.contentType ?? 'application/octet-stream',
    size: a.size ?? 0,
    contentId: a.contentId ?? undefined,
  })) ?? []

  // Mark as read
  markAsRead(backupFolder, session.email, id)

  return NextResponse.json({
    ...meta,
    read: true,
    htmlBody,
    textBody,
    parsedAttachments: attachments,
  })
}
