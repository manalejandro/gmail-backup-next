import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getEmailIndex, getRawEml } from '@/lib/storage'
import { getSettings } from '@/lib/settings'
import nodemailer from 'nodemailer'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session.isLoggedIn || !session.email || !session.password) {
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

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: {
      user: session.email,
      pass: session.password,
    },
  })

  await transporter.sendMail({
    from: session.email,
    to: session.email,
    subject: `[Recovery] ${meta.subject || '(no subject)'}`,
    text: `This email was forwarded from your Gmail Backup for recovery.\n\nOriginal from: ${meta.from}\nOriginal date: ${meta.date}`,
    // Attach the original .eml so Gmail shows it as a full recoverable message
    attachments: [
      {
        filename: `${meta.id}.eml`,
        content: rawBuf,
        contentType: 'message/rfc822',
      },
    ],
  })

  return NextResponse.json({ ok: true })
}
