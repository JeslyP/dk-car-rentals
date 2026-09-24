'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Renter, Rental } from '@/lib/supabase'
import { UndoBar, UndoTarget } from '@/components/UndoBar'
import { formatDate, formatMoney, todayString } from '@/lib/rentals'
import { accountTotals, collectedShare, renterAccounts } from '@/lib/renter-accounts'

/**
 * Every customer's account: what they have been charged, what they have paid,
 * and what is still owed — with the business-wide position on top.
 *
 * The two series colours are the validated categorical slots for this pair;
 * they pass the lightness, chroma, colour-blind separation and contrast checks
 * against both the light and the dark surface. Red/green was the obvious
 * choice and fails colour-blind separation badly, so it is not used for the
 * fills. Both segments are directly labelled, so identity never rests on
 * colour alone.
 */
const PAID_FILL = '#2a78d6'
const OWED_FILL = '#e2622f'

const emptyForm = { name: '', phone: '', email: '', id_number: '' }

export default function RentersPage() {
  const [renters, setRenters] = useState<Renter[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [owingOnly, setOwingOnly] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [undo, setUndo] = useState<UndoTarget | null>(null)

  const load = async () => {
    try {
      const [rn, rt] = await Promise.all([
        api.get<Renter[]>('/api/admin/renters'),
        api.get<Rental[]>('/api/admin/rentals'),
      ])
      setRenters(rn)
      setRentals(rt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load renters.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const today = todayString()
  const accounts = useMemo(() => renterAccounts(renters, rentals, today), [renters, rentals, today])
  const totals = useMemo(() => accountTotals(accounts), [accounts])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.patch(`/api/admin/renters/${editing}`, form)
      else await api.post('/api/admin/renters', form)
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save renter.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their rental history is kept and you can undo this.`)) return
    try {
      await api.delete(`/api/admin/renters/${id}`)
      setUndo({ message: `Removed ${name}.`, restorePath: `/api/admin/renters/${id}/restore` })
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove renter.') }
  }

  const byId = useMemo(() => new Map(renters.map(r => [r.id, r])), [renters])

  const q = search.trim().toLowerCase()
  const shown = accounts.filter(a => {
    if (owingOnly && a.owed <= 0) return false
    if (!q) return true
    const r = a.renterId ? byId.get(a.renterId) : null
    return a.name.toLowerCase().includes(q)
      || (r?.phone || '').includes(q)
      || (r?.email || '').toLowerCase().includes(q)
  })

  // The split is taken over paid + owed rather than over what was charged, so
  // the two segments always fill the bar even if someone has overpaid.
  const split = totals.paid + totals.owed
  const paidPct = split > 0 ? (totals.paid / split) * 100 : 0
  const owedPct = split > 0 ? (totals.owed / split) * 100 : 0

  const openEdit = (id: string) => {
    const r = byId.get(id)
    if (!r) return
    setForm({ name: r.name, phone: r.phone || '', email: r.email || '', id_number: r.id_number || '' })
    setEditing(id)
    setError('')
    setShowForm(true)
  }

  return (
    <div className="dk-renters p-4 md:p-8">
      <style>{`.dk-num { font-variant-numeric: tabular-nums; }`}</style>

      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Renters</h1>
          <p className="text-gray-400 mt-1">What each customer was charged, has paid, and still owes</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }}
          className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 whitespace-nowrap" style={{ background: '#ea580c' }}>
          + Add Renter
        </button>
      </div>

      {error && !showForm && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* The whole book, across every customer */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-1">
          <h2 className="font-bold text-gray-800">Everyone together</h2>
          <p className="text-sm text-gray-400">{accounts.filter(a => a.renterId).length} customers</p>
        </div>
        <p className="text-xs text-gray-400 mb-5">Across every rental ever logged, not just this month</p>

        {/* Three figures side by side is too wide for a phone, so there they
            become label-left / amount-right rows instead. */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-6">
          {[
            { label: 'Charged', value: totals.charged, ink: 'text-gray-900', note: 'Billed in total' },
            { label: 'Paid', value: totals.paid, ink: 'text-gray-900', note: 'Money received' },
            { label: 'Still owed', value: totals.owed, ink: totals.owed > 0 ? 'text-red-600' : 'text-gray-300', note: `${totals.owing} customer${totals.owing === 1 ? '' : 's'}` },
          ].map(t => (
            <div key={t.label}
              className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2 last:border-0 last:pb-0 sm:block sm:border-0 sm:pb-0">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">{t.label}</p>
                <p className="text-xs text-gray-400 sm:hidden">{t.note}</p>
              </div>
              <p className={`text-xl sm:text-2xl md:text-3xl font-black dk-num whitespace-nowrap ${t.ink}`}>{loading ? '—' : formatMoney(t.value)}</p>
              <p className="hidden sm:block text-xs text-gray-400 mt-0.5">{t.note}</p>
            </div>
          ))}
        </div>

        {split > 0 && (
          <>
            <div className="flex gap-[2px] h-11 rounded-lg overflow-hidden" role="img"
              aria-label={`Of ${formatMoney(split)} billed and still open: ${formatMoney(totals.paid)} paid, ${formatMoney(totals.owed)} outstanding`}>
              {paidPct > 0 && (
                <div className="flex items-center justify-center overflow-hidden" title={`Paid ${formatMoney(totals.paid)}`}
                  style={{ width: `${paidPct}%`, background: PAID_FILL }}>
                  {paidPct >= 12 && (
                    <span className="text-xs font-bold px-1.5 truncate text-white">
                      {paidPct >= 26 ? 'Paid · ' : ''}{Math.round(paidPct)}%
                    </span>
                  )}
                </div>
              )}
              {owedPct > 0 && (
                <div className="flex items-center justify-center overflow-hidden" title={`Still owed ${formatMoney(totals.owed)}`}
                  style={{ width: `${owedPct}%`, background: OWED_FILL }}>
                  {owedPct >= 12 && (
                    <span className="text-xs font-bold px-1.5 truncate text-white">
                      {owedPct >= 26 ? 'Owed · ' : ''}{Math.round(owedPct)}%
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
              <span className="flex items-center gap-2 text-gray-600">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: PAID_FILL }} />
                Paid <b className="text-gray-900 dk-num">{formatMoney(totals.paid)}</b>
              </span>
              <span className="flex items-center gap-2 text-gray-600">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: OWED_FILL }} />
                Still owed <b className="text-gray-900 dk-num">{formatMoney(totals.owed)}</b>
              </span>
              {totals.overdue > 0 && (
                <span className="text-gray-600">
                  {totals.overdue >= totals.owed
                    ? <>all of it <b className="text-red-600">past due</b></>
                    : <>of which <b className="text-red-600 dk-num">{formatMoney(totals.overdue)}</b> is past due</>}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {Math.round(collectedShare(totals) * 100)}% of everything you have charged has been collected.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[14rem] max-w-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 bg-white"
          placeholder="🔍 Search by name, phone or email..." />
        <button onClick={() => setOwingOnly(v => !v)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${owingOnly ? 'text-white' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
          style={owingOnly ? { background: '#ea580c' } : {}}>
          Owing only
          {totals.owing > 0 && (
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${owingOnly ? 'bg-white/25' : 'bg-red-100 text-red-600'}`}>
              {totals.owing}
            </span>
          )}
        </button>
      </div>

      {/* Phone: one card per customer, because this table is too wide to scroll on a phone */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No renters found.</p>
        ) : shown.map(a => {
          const r = a.renterId ? byId.get(a.renterId) : null
          return (
            <div key={a.renterId ?? 'none'} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="min-w-0">
                  {a.renterId ? (
                    <Link href={`/admin/renters/${a.renterId}`} className="font-semibold text-gray-800 hover:text-orange-600">{a.name}</Link>
                  ) : (
                    <p className="font-semibold text-gray-500 italic">{a.name}</p>
                  )}
                  <p className="text-xs text-gray-400">{r?.phone || (a.renterId ? 'No phone' : 'Rentals with no customer')}</p>
                </div>
                <p className={`text-xl font-black dk-num ${a.owed > 0 ? 'text-red-600' : 'text-gray-300'}`}>{formatMoney(a.owed)}</p>
              </div>
              <dl className="text-sm dk-num space-y-1">
                <div className="flex justify-between"><dt className="text-gray-500">Rentals</dt><dd className="text-gray-700">{a.rentals}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Charged</dt><dd className="text-gray-700">{formatMoney(a.charged)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Paid</dt><dd className="text-gray-700">{formatMoney(a.paid)}</dd></div>
                {a.overdue > 0 && (
                  <div className="flex justify-between"><dt className="text-gray-500">Past due</dt><dd className="text-red-600 font-semibold">{formatMoney(a.overdue)}</dd></div>
                )}
                <div className="flex justify-between"><dt className="text-gray-500">Last rental</dt><dd className="text-gray-700">{a.lastRental ? formatDate(a.lastRental) : '—'}</dd></div>
              </dl>
              {a.renterId && (
                <div className="flex gap-1 mt-4">
                  <Link href={`/admin/renters/${a.renterId}`} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Statement</Link>
                  <button onClick={() => openEdit(a.renterId!)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Edit</button>
                  <button onClick={() => remove(a.renterId!, a.name)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition">🗑️</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden 2xl:table-cell">Phone</th>
                <th className="px-4 py-3 text-right">Rentals</th>
                <th className="px-4 py-3 text-right">Charged</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Owed</th>
                <th className="px-4 py-3 text-left">Last<br />rental</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">No renters found.</td></tr>
              ) : shown.map(a => {
                const r = a.renterId ? byId.get(a.renterId) : null
                return (
                  <tr key={a.renterId ?? 'none'} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      {a.renterId ? (
                        <Link href={`/admin/renters/${a.renterId}`} className="font-medium text-gray-800 hover:text-orange-600 whitespace-nowrap">{a.name}</Link>
                      ) : (
                        <span className="text-gray-500 italic whitespace-nowrap">{a.name}</span>
                      )}
                      {a.overdue > 0 && (
                        <span className="block mt-1 w-fit px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase whitespace-nowrap">
                          {formatMoney(a.overdue)} past due
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap hidden 2xl:table-cell">{r?.phone || '—'}</td>
                    <td className="px-4 py-4 text-right text-gray-500 dk-num">{a.rentals}</td>
                    <td className="px-4 py-4 text-right text-gray-700 dk-num">{formatMoney(a.charged)}</td>
                    <td className="px-4 py-4 text-right text-gray-700 dk-num">{formatMoney(a.paid)}</td>
                    <td className={`px-4 py-4 text-right dk-num ${a.owed > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}`}>{formatMoney(a.owed)}</td>
                    <td className="px-4 py-4 text-gray-400 text-xs whitespace-nowrap">{a.lastRental ? formatDate(a.lastRental) : '—'}</td>
                    <td className="px-4 py-4">
                      {a.renterId && (
                        <div className="flex gap-1">
                          <Link href={`/admin/renters/${a.renterId}`} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition whitespace-nowrap">Statement</Link>
                          <button onClick={() => openEdit(a.renterId!)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Edit</button>
                          <button onClick={() => remove(a.renterId!, a.name)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition">🗑️</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {!loading && shown.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200 dk-num">
                  <td className="px-4 py-3">{shown.length === accounts.length ? 'Everyone' : 'These customers'}</td>
                  <td className="px-4 py-3 hidden 2xl:table-cell"></td>
                  <td className="px-4 py-3 text-right">{shown.reduce((s, a) => s + a.rentals, 0)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(shown.reduce((s, a) => s + a.charged, 0))}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(shown.reduce((s, a) => s + a.paid, 0))}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatMoney(shown.reduce((s, a) => s + a.owed, 0))}</td>
                  <td className="px-4 py-3" colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <UndoBar target={undo} onDone={load} onDismiss={() => setUndo(null)} />
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">{editing ? 'Edit Renter' : 'Add Renter'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ID Number</label>
                <input value={form.id_number} onChange={e => setForm({...form, id_number: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="Driver's license or national ID" />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={saving}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#ea580c' }}>
                {saving ? 'Saving...' : editing ? 'Update Renter' : 'Add Renter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
