import { getIronSession, type IronSession } from 'iron-session'
import { cookies } from 'next/headers'
import type { SessionData } from './types'

const COOKIE_PASSWORD =
  process.env.SECRET_COOKIE_PASSWORD ??
  'gmail-backup-next-dev-secret-key-min-32chars'

if (COOKIE_PASSWORD.length < 32) {
  throw new Error('SECRET_COOKIE_PASSWORD must be at least 32 characters long')
}

export const sessionOptions = {
  password: COOKIE_PASSWORD,
  cookieName: 'gbn_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  )
  return session
}
