import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { Pop3Client } from '@/lib/pop3-client'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json() as { email?: string; password?: string }

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Try to connect to Gmail POP3
    const pop3 = new Pop3Client()
    try {
      await pop3.connect('pop.gmail.com', 995)
      await pop3.auth(email, password)
      await pop3.quit()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('auth')) {
        return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 })
      }
      return NextResponse.json({ error: 'connectionFailed' }, { status: 502 })
    }

    // Store credentials in session (encrypted cookie via iron-session)
    const session = await getSession()
    session.isLoggedIn = true
    session.email = email
    session.password = password
    await session.save()

    return NextResponse.json({ ok: true, email })
  } catch {
    return NextResponse.json({ error: 'generic' }, { status: 500 })
  }
}
