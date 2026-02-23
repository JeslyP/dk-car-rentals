'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const a = sessionStorage.getItem('dk_admin')
    if (a === 'true') setAuthed(true)
  }, [])

  const login = (e: React.FormEvent) => {
    e.preventDefault()
    // Simple password check - in production use proper auth
    if (password === (process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'dkrentals2024')) {
      sessionStorage.setItem('dk_admin', 'true')
      setAuthed(true)
    } else {
      setError('Incorrect password. Try again.')
    }
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#1c1917' }}>
        <div className="bg-white rounded-3xl p-10 w-full max-w-md shadow-2xl text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6" style={{ background: '#ea580c' }}>
            DK
          </div>
          <h2 className="font-display text-3xl font-bold mb-2" style={{ color: '#1c1917' }}>Admin Portal</h2>
          <p className="text-gray-400 text-sm mb-8">D&K Car Rentals Management</p>
          <form onSubmit={login} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400"
              placeholder="Enter admin password"
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button type="submit" className="w-full py-3 rounded-xl text-white font-bold transition hover:opacity-90" style={{ background: '#ea580c' }}>
              Login
            </button>
          </form>
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 mt-6 block">← Back to website</a>
        </div>
      </div>
    )
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: '📊' },
    { href: '/admin/vehicles', label: 'Vehicles', icon: '🚗' },
    { href: '/admin/rentals', label: 'Rentals', icon: '📋' },
    { href: '/admin/renters', label: 'Renters', icon: '👥' },
    { href: '/admin/requests', label: 'Requests', icon: '📬' },
    { href: '/admin/reports', label: 'Reports', icon: '📈' },
  ]

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="admin-sidebar w-64 flex-shrink-0 flex flex-col">
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
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                pathname === item.href
                  ? 'text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
              style={pathname === item.href ? { background: '#ea580c' } : {}}
            >
              <span>{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white text-sm transition">
            🌐 View Website
          </a>
          <button
            onClick={() => { sessionStorage.removeItem('dk_admin'); setAuthed(false) }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-red-400 text-sm w-full transition"
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}
