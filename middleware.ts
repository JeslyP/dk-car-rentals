import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'

/**
 * Every /api/admin/* route except login and session requires a valid admin
 * session cookie. The admin pages themselves are client components that ask
 * /api/admin/session and show the login form when it says no.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/api/admin/login' || pathname === '/api/admin/session') return NextResponse.next()
  if (!(await isAuthenticatedRequest(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/api/admin/:path*'],
}
