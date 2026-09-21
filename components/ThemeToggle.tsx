'use client'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export const THEME_KEY = 'dk_theme'

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem(THEME_KEY, theme) } catch { /* private window */ }
}

/**
 * Light and dark switch. Follows the device until someone chooses, after
 * which the choice sticks on that browser. The first paint is handled by the
 * inline script in the root layout, so there is no flash of the wrong theme.
 */
export function ThemeToggle({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const current = (document.documentElement.getAttribute('data-theme') as Theme | null) ?? systemTheme()
    setTheme(current)
    setReady(true)
  }, [])

  // Keep following the device for anyone who has not chosen for themselves.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const onChange = () => {
      let stored: string | null = null
      try { stored = localStorage.getItem(THEME_KEY) } catch { /* ignore */ }
      if (stored) return
      const next = mq.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      setTheme(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    apply(next)
    setTheme(next)
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <button onClick={toggle} title={label} aria-label={label}
      className={compact ? className : `flex items-center gap-3 px-4 py-3 rounded-xl text-sm w-full transition ${className}`}>
      {/* Until mounted both icons would be a guess, so show nothing rather than the wrong one. */}
      <span aria-hidden="true" className={ready ? '' : 'opacity-0'}>{theme === 'dark' ? '☀️' : '🌙'}</span>
      {!compact && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
