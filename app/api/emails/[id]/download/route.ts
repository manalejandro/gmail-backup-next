import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getEmailIndex, getRawEml } from '@/lib/storage'
import { getSettings } from '@/lib/settings'

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

  const filename = `${id}.eml`

  return new NextResponse(new Uint8Array(rawBuf), {
    headers: {
      'Content-Type': 'message/rfc822',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': rawBuf.length.toString(),
    },
  })
}
