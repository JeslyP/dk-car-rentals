'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Expense, Vehicle } from '@/lib/supabase'
import { formatDate, formatMoney, todayString } from '@/lib/rentals'
import {
  CATEGORY_LABELS, EXPENSE_CATEGORIES, currentMonthKey, expensesCsv, monthEnd, monthLabel,
  monthStart, shiftMonthKey, vehicleLabel,
} from '@/lib/finance'
import { UndoBar, UndoTarget } from '@/components/UndoBar'
import { MoneyInput } from '@/components/MoneyInput'

const CATEGORY_ICONS: Record<string, string> = {
  fuel: '⛽', maintenance: '🔧', repair: '🛠️', tires: '🛞', parts: '⚙️', insurance: '🛡️',
  registration: '📄', cleaning: '🧽', towing: '🚛', loan: '🏦', fees: '💳', other: '📦',
}

const emptyForm = {
  spent_on: '', vehicle_id: '', category: 'fuel', amount: 0,
  vendor: '', description: '', odometer: '' as string,
}
type Form = typeof emptyForm

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [month, setMonth] = useState(currentMonthKey())
  const [scope, setScope] = useState<'month' | 'year' | 'all'>('month')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [undo, setUndo] = useState<UndoTarget | null>(null)

  const range = useMemo(() => {
    if (scope === 'all') return null
    if (scope === 'year') {
      const year = month.slice(0, 4)
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    }
    return { from: monthStart(month), to: monthEnd(month) }
  }, [scope, month])

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      if (range) { params.set('from', range.from); params.set('to', range.to) }
      if (vehicleFilter) params.set('vehicle_id', vehicleFilter)
      if (categoryFilter) params.set('category', categoryFilter)
      const qs = params.toString()
      const [e, v] = await Promise.all([
        api.get<Expense[]>(`/api/admin/expenses${qs ? `?${qs}` : ''}`),
        api.get<Vehicle[]>('/api/admin/vehicles'),
      ])
      setExpenses(e)
      setVehicles(v)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load expenses.')
    } finally {
      setLoading(false)
    }
  }, [range, vehicleFilter, categoryFilter])

  useEffect(() => { load() }, [load])

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of expenses) map.set(e.category, (map.get(e.category) || 0) + Number(e.amount))
    return Array.from(map, ([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const openNew = () => {
    setForm({ ...emptyForm, spent_on: todayString() })
    setEditing(null)
    setError('')
    setShowForm(true)
  }

  const openEdit = (e: Expense) => {
    setForm({
      spent_on: e.spent_on,
      vehicle_id: e.vehicle_id || '',
      category: e.category,
      amount: Number(e.amount),
      vendor: e.vendor || '',
      description: e.description || '',
      odometer: e.odometer === null ? '' : String(e.odometer),
    })
    setEditing(e.id)
    setError('')
    setShowForm(true)
  }

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        spent_on: form.spent_on,
        vehicle_id: form.vehicle_id || null,
        category: form.category,
        amount: Number(form.amount),
        vendor: form.vendor || null,
        description: form.description || null,
        odometer: form.odometer === '' ? null : Number(form.odometer),
      }
      if (editing) await api.patch(`/api/admin/expenses/${editing}`, payload)
      else await api.post('/api/admin/expenses', payload)
      setShowForm(false)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this cost.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (e: Expense) => {
    const label = CATEGORY_LABELS[e.category as never] || e.category
    if (!confirm(`Remove this ${label} cost of ${formatMoney(e.amount)}? It stays in your records and you can undo this.`)) return
    try {
      await api.delete(`/api/admin/expenses/${e.id}`)
      setUndo({ message: `Removed a ${label} cost of ${formatMoney(e.amount)}.`, restorePath: `/api/admin/expenses/${e.id}/restore` })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove this cost.')
    }
  }

  const downloadCsv = () => {
    const csv = expensesCsv(expenses as never)
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dj-expenses-${scope === 'all' ? 'all-time' : scope === 'year' ? month.slice(0, 4) : month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const periodTitle = scope === 'all' ? 'All time' : scope === 'year' ? month.slice(0, 4) : monthLabel(month)
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400'

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Costs</h1>
          <p className="text-gray-400 mt-1">Fuel, repairs, insurance and anything else you spend on the cars</p>
        </div>
        <button onClick={openNew} className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 whitespace-nowrap" style={{ background: '#ea580c' }}>
          + Add a cost
        </button>
      </div>

      {error && !showForm && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* Period + filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            {(['month', 'year', 'all'] as const).map(s => (
              <button key={s} onClick={() => setScope(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition ${scope === s ? 'text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                style={scope === s ? { background: '#ea580c' } : {}}>
                {s === 'all' ? 'All time' : s}
              </button>
            ))}
          </div>

          {scope !== 'all' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setMonth(shiftMonthKey(month, scope === 'year' ? -12 : -1))} className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100">‹</button>
              <span className="font-semibold text-gray-800 text-sm min-w-[7.5rem] text-center">{periodTitle}</span>
              <button onClick={() => setMonth(shiftMonthKey(month, scope === 'year' ? 12 : 1))} className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100">›</button>
            </div>
          )}

          <select value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
            <option value="">All vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>)}
          </select>

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>

          {expenses.length > 0 && (
            <button onClick={downloadCsv} className="ml-auto px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              ⬇ Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Total + category split */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">Total spent · {periodTitle}</p>
          <p className="text-3xl font-black text-red-600 mt-1">{loading ? '—' : formatMoney(total)}</p>
          <p className="text-gray-400 text-xs mt-1">{expenses.length} entr{expenses.length === 1 ? 'y' : 'ies'}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 md:col-span-2">
          <p className="text-gray-400 text-sm mb-3">Where it went</p>
          {byCategory.length === 0 ? (
            <p className="text-gray-400 text-sm">Nothing recorded for this period.</p>
          ) : (
            <div className="space-y-2">
              {byCategory.slice(0, 5).map(c => (
                <div key={c.category}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{CATEGORY_ICONS[c.category]} {CATEGORY_LABELS[c.category as never] || c.category}</span>
                    <span className="text-gray-500">{formatMoney(c.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full bg-red-400" style={{ width: `${total > 0 ? (c.amount / total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-left">Vendor</th>
                <th className="px-6 py-3 text-left">Notes</th>
                <th className="px-6 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                  <p className="text-4xl mb-3">🧾</p>
                  <p>No costs recorded for {periodTitle.toLowerCase()}.</p>
                  <button onClick={openNew} className="text-orange-500 font-medium mt-2">Add the first one →</button>
                </td></tr>
              ) : expenses.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDate(e.spent_on)}</td>
                  <td className="px-6 py-4 text-gray-600">{e.vehicle ? `${e.vehicle.year} ${e.vehicle.make} ${e.vehicle.model}` : <span className="text-gray-400">Whole business</span>}</td>
                  <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{CATEGORY_ICONS[e.category]} {CATEGORY_LABELS[e.category as never] || e.category}</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-800">{formatMoney(e.amount)}</td>
                  <td className="px-6 py-4 text-gray-500">{e.vendor || '—'}</td>
                  <td className="px-6 py-4 text-gray-500 max-w-[16rem] truncate" title={e.description || ''}>{e.description || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(e)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Edit</button>
                      <button onClick={() => remove(e)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-800">
                  <td className="px-6 py-3" colSpan={3}>Total</td>
                  <td className="px-6 py-3 text-right">{formatMoney(total)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <UndoBar target={undo} onDone={load} onDismiss={() => setUndo(null)} />
      {/* Add / edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 w-full sm:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">{editing ? 'Edit cost' : 'Add a cost'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">×</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">What kind of cost? *</label>
                <div className="grid grid-cols-3 gap-2">
                  {EXPENSE_CATEGORIES.map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                      className={`px-2 py-3 rounded-xl text-xs font-semibold border transition ${form.category === c ? 'text-white border-transparent' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                      style={form.category === c ? { background: '#ea580c' } : {}}>
                      <span className="block text-lg leading-none mb-1">{CATEGORY_ICONS[c]}</span>
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Amount ($) *</label>
                  <MoneyInput required autoFocus
                    value={form.amount} onChange={amount => setForm(f => ({ ...f, amount }))}
                    className={`${inputCls} text-lg font-bold`} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Date *</label>
                  <input required type="date" value={form.spent_on} onChange={e => setForm({ ...form, spent_on: e.target.value })} className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Which vehicle?</label>
                <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} className={inputCls}>
                  <option value="">Whole business (not one car)</option>
                  {vehicles.map(v => <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.license_plate})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Paid to</label>
                  <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} className={inputCls} placeholder="Shop or station name" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Odometer</label>
                  <input type="number" min={0} value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} className={inputCls} placeholder="optional" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Note</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className={`${inputCls} resize-none`} rows={2} placeholder="e.g. new front brake pads" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={saving || !form.amount}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50" style={{ background: '#ea580c' }}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add cost'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
