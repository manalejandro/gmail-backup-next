import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getEmailIndex } from '@/lib/storage'
import { getSettings } from '@/lib/settings'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn || !session.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q')?.toLowerCase() ?? ''
  const field = searchParams.get('field') ?? 'all'   // 'all' | 'from' | 'subject'
  const dateFrom = searchParams.get('dateFrom') ?? ''   // YYYY-MM-DD
  const dateTo = searchParams.get('dateTo') ?? ''       // YYYY-MM-DD
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 50

  const { backupFolder } = getSettings()
  let emails = getEmailIndex(backupFolder, session.email)

  if (search) {
    if (field === 'from') {
      emails = emails.filter(e => e.from.toLowerCase().includes(search))
    } else if (field === 'subject') {
      emails = emails.filter(e => e.subject.toLowerCase().includes(search))
    } else {
      emails = emails.filter(
        e =>
          e.subject.toLowerCase().includes(search) ||
          e.from.toLowerCase().includes(search) ||
          e.to.toLowerCase().includes(search)
      )
    }
  }

  // Date filter: compare the YYYY-MM-DD prefix of each ISO date string
  if (dateFrom) {
    emails = emails.filter(e => e.date.slice(0, 10) >= dateFrom)
  }
  if (dateTo) {
    emails = emails.filter(e => e.date.slice(0, 10) <= dateTo)
  }

  const total = emails.length
  const start = (page - 1) * limit
  const items = emails.slice(start, start + limit)

  return NextResponse.json({ items, total, page, limit })
}
