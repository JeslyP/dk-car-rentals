'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

export type UndoTarget = { message: string; restorePath: string }

/**
 * Shown after something is deleted. Deletes only hide the record, so putting
 * it back is one press. Sits above the mobile navigation so it is reachable
 * on a phone.
 */
export function UndoBar({ target, onDone, onDismiss }: {
  target: UndoTarget | null
  onDone: () => void | Promise<void>
  onDismiss: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // A new deletion clears whatever the last one said.
  useEffect(() => { setError(''); setBusy(false) }, [target?.restorePath])

  if (!target) return null

  const undo = async () => {
    setBusy(true)
    setError('')
    try {
      await api.post(target.restorePath)
      await onDone()
      onDismiss()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not put that back.')
      setBusy(false)
    }
  }

  return (
    <div className="no-print fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-auto z-50">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">{target.message}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {error || 'Kept in your records. Nothing was permanently erased.'}
          </p>
        </div>
        <button onClick={undo} disabled={busy}
          className="ml-auto px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap disabled:opacity-50"
          style={{ background: '#ea580c' }}>
          {busy ? 'Undoing…' : 'Undo'}
        </button>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-gray-400 hover:text-white text-xl leading-none">×</button>
      </div>
    </div>
  )
}
