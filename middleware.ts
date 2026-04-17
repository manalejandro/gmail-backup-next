import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('gbn_session')

  // Protect dashboard routes
  if (pathname.startsWith('/dashboard') && !sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Redirect logged-in users away from login page
  if (pathname === '/' && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
}
