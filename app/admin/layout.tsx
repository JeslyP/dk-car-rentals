'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { api } from '@/lib/api-client'

type AuthState = 'checking' | 'anonymous' | 'authed'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    api.get<{ authenticated: boolean }>('/api/admin/session')
      .then(r => setAuth(r.authenticated ? 'authed' : 'anonymous'))
      .catch(() => setAuth('anonymous'))
  }, [])

  // Any admin API call that comes back 401 (expired cookie) drops us to the login form.
  useEffect(() => {
    const onUnauthorized = () => setAuth('anonymous')
    window.addEventListener('dk-admin-unauthorized', onUnauthorized)
    return () => window.removeEventListener('dk-admin-unauthorized', onUnauthorized)
  }, [])

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.post('/api/admin/login', { password })
      setPassword('')
      setAuth('authed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  const logout = useCallback(async () => {
    await api.post('/api/admin/logout').catch(() => null)
    setAuth('anonymous')
  }, [])

  // Invoice pages render without the admin chrome so they print cleanly.
  const bare = /^\/admin\/rentals\/[^/]+\/invoice/.test(pathname)

  if (auth === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-gray-400" style={{ background: '#1c1917' }}>Loading…</div>
  }

  if (auth === 'anonymous') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#1c1917' }}>
        <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6" style={{ background: '#ea580c' }}>
            DK
          </div>
          <h2 className="font-display text-3xl font-bold mb-2" style={{ color: '#1c1917' }}>Admin Portal</h2>
          <p className="text-gray-400 text-sm mb-8">D&K Car Rentals Management</p>
          <form onSubmit={login} className="space-y-4">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus autoComplete="current-password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 text-base"
              placeholder="Enter admin password" />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" disabled={busy || !password} className="w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90 disabled:opacity-50" style={{ background: '#ea580c' }}>
              {busy ? 'Signing in…' : 'Login'}
            </button>
          </form>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 mt-6 block">← Back to website</a>
        </div>
      </div>
    )
  }

  if (bare) return <>{children}</>

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/reports', label: 'Money', icon: '💵' },
    { href: '/admin/rentals', label: 'Rentals', icon: '📋' },
    { href: '/admin/expenses', label: 'Costs', icon: '🧾' },
    { href: '/admin/calendar', label: 'Calendar', icon: '📅' },
    { href: '/admin/vehicles', label: 'Vehicles', icon: '🚗' },
    { href: '/admin/renters', label: 'Renters', icon: '👥' },
    { href: '/admin/requests', label: 'Requests', icon: '📬' },
  ]
  const isActive = (href: string) => href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="admin-sidebar hidden md:flex w-64 flex-shrink-0 flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#ea580c' }}>DK</div>
            <div>
              <p className="text-white font-bold text-sm">D&K Car Rentals</p>
              <p className="text-gray-400 text-xs">Admin Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(item => (
            <a key={item.href} href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive(item.href) ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              style={isActive(item.href) ? { background: '#ea580c' } : {}}>
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white text-sm transition">
            🌐 View Website
          </a>
          <button onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 text-sm w-full transition">
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="admin-mobile-bar md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: '#1c1917' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs" style={{ background: '#ea580c' }}>DK</div>
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 text-xs">🌐 Site</a>
          <button onClick={logout} className="text-gray-400 text-xs">🚪 Out</button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 overflow-auto md:pb-0 pb-20 pt-14 md:pt-0 min-w-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="admin-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 overflow-x-auto" style={{ background: '#1c1917' }}>
        {navItems.map(item => (
          <a key={item.href} href={item.href}
            className={`flex-1 min-w-[56px] flex flex-col items-center justify-center py-2 text-xs transition ${
              isActive(item.href) ? 'text-orange-400' : 'text-gray-500'
            }`}>
            <span className="text-lg leading-none mb-1">{item.icon}</span>
            <span className="text-[10px]">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  )
}
