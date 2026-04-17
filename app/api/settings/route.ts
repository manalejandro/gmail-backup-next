import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getSettings, saveSettings } from '@/lib/settings'
import type { AppSettings } from '@/lib/types'

export async function GET() {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(getSettings())
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json() as Partial<AppSettings>
  const updated = saveSettings(body)
  return NextResponse.json(updated)
}
