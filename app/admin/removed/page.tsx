'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { RemovedItem } from '@/app/api/admin/removed/route'
import { formatDate } from '@/lib/rentals'

/**
 * Everything a delete has hidden. Two ways out: put it back, or destroy it
 * for good. Permanent deletion lives only here, so it can never be reached
 * by one stray tap on an ordinary list.
 */
export default function RemovedPage() {
  const [items, setItems] = useState<RemovedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setItems(await api.get<RemovedItem[]>('/api/admin/removed')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load removed items.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const restore = async (item: RemovedItem) => {
    setBusy(item.id); setError(''); setNotice('')
    try {
      await api.post(`/api/admin/${item.path}/${item.id}/restore`)
      setNotice(`Put back: ${item.label}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not put that back.')
    } finally { setBusy(null) }
  }

  const purge = async (item: RemovedItem) => {
    const warning = [
      `Destroy "${item.label}" for good?`,
      '',
      item.consequence ?? '',
      '',
      'This cannot be undone and it will not be in any backup you take afterwards.',
    ].filter(Boolean).join('\n')
    if (!confirm(warning)) return

    setBusy(item.id); setError(''); setNotice('')
    try {
      await api.delete(`/api/admin/${item.path}/${item.id}/purge`)
      setNotice(`Destroyed for good: ${item.label}.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not destroy that record.')
    } finally { setBusy(null) }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-800">Removed items</h1>
        <p className="text-gray-400 mt-1">Things a delete has hidden. Nothing here counts towards any total or report.</p>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      {notice && <div className="mb-6 p-4 rounded-xl bg-green-50 text-green-700 text-sm">{notice}</div>}

      <div className="rounded-2xl p-5 mb-6 text-sm" style={{ background: 'var(--brand-tint)' }}>
        <p className="font-bold" style={{ color: 'var(--brand-tint-ink)' }}>Before you destroy anything</p>
        <p className="mt-1" style={{ color: 'var(--brand-tint-ink-2)' }}>
          Removed records cost nothing to keep and they are the safest place for anything a tax
          authority might ask about later. Only destroy something that was entered by mistake,
          like a test entry or a duplicate. Destroying is permanent.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="px-6 py-12 text-center text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400">
            <p className="text-4xl mb-3">🗑️</p>
            <p>Nothing has been removed.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map(item => (
              <li key={`${item.resource}-${item.id}`} className="px-6 py-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800">{item.label}</p>
                  <p className="text-gray-500 text-sm">{item.detail}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
                    Removed {item.deleted_at ? formatDate(item.deleted_at.slice(0, 10)) : 'at an unknown time'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => restore(item)} disabled={busy === item.id}
                    className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                    style={{ background: '#ea580c' }}>
                    {busy === item.id ? '…' : 'Put back'}
                  </button>
                  <button onClick={() => purge(item)} disabled={busy === item.id}
                    className="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition disabled:opacity-50">
                    Destroy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <p className="text-xs text-gray-400 mt-4">
          {items.length} removed item{items.length === 1 ? '' : 's'}. These stay in your full backup file until destroyed.
        </p>
      )}
    </div>
  )
}
