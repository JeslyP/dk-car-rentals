import { afterEach, describe, expect, it } from 'vitest'
import { checkLoginRateLimit, createSessionToken, getAdminConfig, isAuthenticatedRequest, safeEqual, SESSION_COOKIE, verifySessionToken } from '@/lib/auth'

const secret = 'test-secret'

describe('session tokens', () => {
  it('round-trips a valid token', async () => {
    const token = await createSessionToken(secret)
    expect(await verifySessionToken(secret, token)).toBe(true)
  })
  it('rejects tokens signed with another secret', async () => {
    const token = await createSessionToken('other')
    expect(await verifySessionToken(secret, token)).toBe(false)
  })
  it('rejects expired tokens', async () => {
    const issued = Date.now() - 10_000
    const token = await createSessionToken(secret, issued, 5)
    expect(await verifySessionToken(secret, token)).toBe(false)
  })
  it('rejects malformed tokens', async () => {
    expect(await verifySessionToken(secret, '')).toBe(false)
    expect(await verifySessionToken(secret, null)).toBe(false)
    expect(await verifySessionToken(secret, 'abc')).toBe(false)
    expect(await verifySessionToken(secret, '123.notahexsignature')).toBe(false)
  })
  it('rejects a tampered expiry', async () => {
    const token = await createSessionToken(secret)
    const [exp, sig] = token.split('.')
    expect(await verifySessionToken(secret, `${Number(exp) + 100000}.${sig}`)).toBe(false)
  })
})

describe('isAuthenticatedRequest', () => {
  it('reads the cookie from a Request', async () => {
    process.env.ADMIN_PASSWORD = 'pw'
    process.env.ADMIN_SESSION_SECRET = secret
    const token = await createSessionToken(secret)
    const ok = new Request('http://x/api/admin/vehicles', { headers: { cookie: `foo=bar; ${SESSION_COOKIE}=${token}` } })
    const bad = new Request('http://x/api/admin/vehicles', { headers: { cookie: `${SESSION_COOKIE}=nope` } })
    const none = new Request('http://x/api/admin/vehicles')
    expect(await isAuthenticatedRequest(ok)).toBe(true)
    expect(await isAuthenticatedRequest(bad)).toBe(false)
    expect(await isAuthenticatedRequest(none)).toBe(false)
  })
})

describe('safeEqual', () => {
  it('compares strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
    expect(safeEqual('', '')).toBe(true)
  })
})

describe('login rate limit', () => {
  it('blocks after the allowed attempts within the window', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) expect(checkLoginRateLimit('1.1.1.1', now, 3, 1000)).toBe(true)
    expect(checkLoginRateLimit('1.1.1.1', now + 10, 3, 1000)).toBe(false)
    expect(checkLoginRateLimit('1.1.1.1', now + 2000, 3, 1000)).toBe(true)
    expect(checkLoginRateLimit('2.2.2.2', now + 10, 3, 1000)).toBe(true)
  })
})

describe('admin password configuration', () => {
  const original = process.env.ADMIN_PASSWORD

  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_PASSWORD
    else process.env.ADMIN_PASSWORD = original
  })

  it('ignores whitespace around the configured password', () => {
    process.env.ADMIN_PASSWORD = '  Jesus4me\n'
    expect(getAdminConfig().password).toBe('Jesus4me')
  })

  it('still rejects a password that is only whitespace', () => {
    process.env.ADMIN_PASSWORD = '   '
    expect(() => getAdminConfig()).toThrow(/ADMIN_PASSWORD is not set/)
  })

  it('keeps the password case sensitive', () => {
    expect(safeEqual('Jesus4me', 'jesus4me')).toBe(false)
    expect(safeEqual('Jesus4me', 'Jesus4me')).toBe(true)
  })
})
