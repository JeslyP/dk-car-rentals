import { NextResponse } from 'next/server'
import { checkLoginRateLimit, createSessionToken, getAdminConfig, resetLoginRateLimit, safeEqual, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (!checkLoginRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 })
  }

  let config
  try {
    config = getAdminConfig()
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Server not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  // Trimmed to match getAdminConfig: a trailing space from a phone keyboard
  // should not read as the wrong password.
  const password = typeof body?.password === 'string' ? body.password.trim() : ''
  if (!password || !safeEqual(password, config.password)) {
    return NextResponse.json({ error: 'Incorrect password. Try again.' }, { status: 401 })
  }

  resetLoginRateLimit(ip)
  const token = await createSessionToken(config.secret)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions())
  return res
}
