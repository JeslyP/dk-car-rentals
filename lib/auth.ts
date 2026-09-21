/**
 * Admin session handling.
 *
 * The admin password never reaches the browser. On login the server compares
 * the submitted password with ADMIN_PASSWORD and, if it matches, issues a
 * signed, expiring token in an httpOnly cookie. Middleware and API routes
 * verify that token with HMAC-SHA256 via Web Crypto, so the same code runs in
 * the Edge runtime (middleware) and in Node route handlers.
 */

export const SESSION_COOKIE = 'dk_admin_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

const encoder = new TextEncoder()

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret)
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)))
}

/** Constant-time string comparison to avoid leaking information through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  let diff = ab.length ^ bb.length
  const len = Math.max(ab.length, bb.length)
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

/** Create a session token that expires `ttlSeconds` from `now`. */
export async function createSessionToken(secret: string, now = Date.now(), ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  const exp = String(Math.floor(now / 1000) + ttlSeconds)
  const sig = await sign(secret, exp)
  return `${exp}.${sig}`
}

/** Returns true when the token is well-formed, signed with `secret`, and not expired. */
export async function verifySessionToken(secret: string, token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!/^\d+$/.test(exp) || !/^[0-9a-f]{64}$/.test(sig)) return false
  if (Number(exp) * 1000 <= now) return false
  const expected = await sign(secret, exp)
  return safeEqual(expected, sig)
}

/** Server-side config. Throws a clear error when the deployment is not configured. */
export function getAdminConfig(): { password: string; secret: string } {
  // Surrounding whitespace is almost always accidental: a stray space typed on
  // a phone, or one that rode along when the value was pasted into the hosting
  // provider. Ignore it on both sides rather than rejecting a correct password.
  const password = process.env.ADMIN_PASSWORD?.trim()
  if (!password) {
    throw new Error('ADMIN_PASSWORD is not set. Add it to .env.local (or your hosting provider\'s environment variables).')
  }
  // A dedicated secret is best; fall back to deriving one from the password so a
  // fresh install still works with a single variable.
  const secret = process.env.ADMIN_SESSION_SECRET || `dk-session:${password}`
  return { password, secret }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  }
}

/** Reads the session cookie from a Request and verifies it. */
export async function isAuthenticatedRequest(req: Request): Promise<boolean> {
  const cookie = req.headers.get('cookie') || ''
  const match = cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${SESSION_COOKIE}=`))
  const token = match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null
  let secret: string
  try {
    secret = getAdminConfig().secret
  } catch {
    return false
  }
  return verifySessionToken(secret, token)
}

/**
 * Minimal in-memory login rate limiter (per process). On serverless hosts each
 * instance keeps its own counter, so treat this as a speed bump, not a wall.
 */
const attempts = new Map<string, { count: number; resetAt: number }>()
export function checkLoginRateLimit(ip: string, now = Date.now(), max = 10, windowMs = 15 * 60 * 1000): boolean {
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + windowMs })
    return true
  }
  entry.count += 1
  return entry.count <= max
}
export function resetLoginRateLimit(ip: string) {
  attempts.delete(ip)
}
