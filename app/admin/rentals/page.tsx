'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Payment, Rental, Renter, Vehicle } from '@/lib/supabase'
import { balanceDue, formatDate, formatMoney, isActiveRental, isUpcomingRental, rentalDays, rentalTotal, todayString } from '@/lib/rentals'
import { PAYMENT_METHODS } from '@/lib/finance'
import { UndoBar, UndoTarget } from '@/components/UndoBar'

const emptyForm = {
  vehicle_id: '', renter_id: '', start_date: '', end_date: '',
  daily_rate: 0, total_charge: 0, notes: '',
  // Only used when creating: money handed over at the start.
  deposit: 0, deposit_date: '',
}
type Form = typeof emptyForm

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', transfer: 'Bank transfer', card: 'Card', cheque: 'Cheque', other: 'Other',
}

export default function RentalsPage() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [renters, setRenters] = useState<Renter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form>(emptyForm)
  const [newRenter, setNewRenter] = useState({ name: '', phone: '', email: '' })
  const [addingRenter, setAddingRenter] = useState(false)

  // Payment drawer state
  const [paying, setPaying] = useState<Rental | null>(null)
  const [history, setHistory] = useState<Payment[]>([])
  const [payForm, setPayForm] = useState({ amount: 0, paid_on: '', method: 'cash' })
  const [payBusy, setPayBusy] = useState(false)
  const [undo, setUndo] = useState<UndoTarget | null>(null)

  const load = useCallback(async () => {
    try {
      const [r, v, rn] = await Promise.all([
        api.get<Rental[]>('/api/admin/rentals'),
        api.get<Vehicle[]>('/api/admin/vehicles'),
        api.get<Renter[]>('/api/admin/renters'),
      ])
      setRentals(r)
      setVehicles([...v].sort((a, b) => a.make.localeCompare(b.make)))
      setRenters(rn)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load rentals.')
    }
  }, [])
  useEffect(() => { load() }, [load])

  // Keep the total in step with the dates and rate.
  useEffect(() => {
    if (form.start_date && form.end_date && form.daily_rate && form.end_date >= form.start_date) {
      setForm(f => ({ ...f, total_charge: rentalTotal(f.start_date, f.end_date, f.daily_rate) }))
    }
  }, [form.start_date, form.end_date, form.daily_rate])

  const handleVehicleChange = (id: string) => {
    const v = vehicles.find(v => v.id === id)
    setForm(f => ({ ...f, vehicle_id: id, daily_rate: v ? Number(v.daily_rate) : 0 }))
  }

  const createRenter = async () => {
    if (!newRenter.name) return
    try {
      const data = await api.post<Renter>('/api/admin/renters', newRenter)
      setRenters(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, renter_id: data.id }))
      setAddingRenter(false)
      setNewRenter({ name: '', phone: '', email: '' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add renter.')
    }
  }

  const openNew = () => {
    setForm({ ...emptyForm, deposit_date: todayString() })
    setEditing(null)
    setError('')
    setShowForm(true)
  }

  const openEdit = (r: Rental) => {
    setForm({
      ...emptyForm,
      vehicle_id: r.vehicle_id || '', renter_id: r.renter_id || '',
      start_date: r.start_date, end_date: r.end_date,
      daily_rate: Number(r.daily_rate), total_charge: Number(r.total_charge),
      notes: r.notes || '',
    })
    setEditing(r.id)
    setError('')
    setShowForm(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        vehicle_id: form.vehicle_id, renter_id: form.renter_id,
        start_date: form.start_date, end_date: form.end_date,
        daily_rate: form.daily_rate, total_charge: form.total_charge, notes: form.notes,
        ...(editing || form.deposit <= 0 ? {} : {
          initial_payment: { amount: form.deposit, paid_on: form.deposit_date || form.start_date, method: 'cash' },
        }),
      }
      if (editing) await api.patch(`/api/admin/rentals/${editing}`, payload)
      else await api.post('/api/admin/rentals', payload)
      setShowForm(false)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save rental.')
    } finally {
      setSaving(false)
    }
  }

  const openPayments = async (r: Rental) => {
    setPaying(r)
    setError('')
    setHistory([])
    setPayForm({ amount: balanceDue(Number(r.total_charge), Number(r.amount_paid)), paid_on: todayString(), method: 'cash' })
    try {
      setHistory(await api.get<Payment[]>(`/api/admin/payments?rental_id=${r.id}`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load payment history.')
    }
  }

  const addPayment = async () => {
    if (!paying || payForm.amount <= 0) return
    setPayBusy(true)
    setError('')
    try {
      await api.post('/api/admin/payments', {
        rental_id: paying.id, amount: payForm.amount, paid_on: payForm.paid_on, method: payForm.method,
      })
      const [fresh, updated] = await Promise.all([
        api.get<Payment[]>(`/api/admin/payments?rental_id=${paying.id}`),
        api.get<Rental>(`/api/admin/rentals/${paying.id}`),
      ])
      setHistory(fresh)
      setPaying(updated)
      setPayForm(f => ({ ...f, amount: balanceDue(Number(updated.total_charge), Number(updated.amount_paid)) }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record the payment.')
    } finally {
      setPayBusy(false)
    }
  }

  const deletePayment = async (p: Payment) => {
    if (!confirm(`Remove the ${formatMoney(p.amount)} payment from ${formatDate(p.paid_on)}? It stays in your records.`)) return
    try {
      await api.delete(`/api/admin/payments/${p.id}`)
      if (paying) {
        const [fresh, updated] = await Promise.all([
          api.get<Payment[]>(`/api/admin/payments?rental_id=${paying.id}`),
          api.get<Rental>(`/api/admin/rentals/${paying.id}`),
        ])
        setHistory(fresh)
        setPaying(updated)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the payment.')
    }
  }

  const remove = async (r: Rental) => {
    if (!confirm(`Remove the rental for ${r.renter?.name || 'this customer'}? It stays in your records and you can undo this.`)) return
    try {
      await api.delete(`/api/admin/rentals/${r.id}`)
      setUndo({ message: `Removed the rental for ${r.renter?.name || 'this customer'}.`, restorePath: `/api/admin/rentals/${r.id}/restore` })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove rental.')
    }
  }

  const today = todayString()
  const filtered = rentals.filter(r => {
    if (filter === 'unpaid') return r.payment_status !== 'paid'
    if (filter === 'paid') return r.payment_status === 'paid'
    if (filter === 'active') return isActiveRental(r, today)
    if (filter === 'upcoming') return isUpcomingRental(r, today)
    return true
  })
  const owedTotal = rentals.reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)

  const num = (v: string) => (v === '' ? 0 : Number(v))
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400'

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Rentals</h1>
          <p className="text-gray-400 mt-1">
            Log rentals and record payments
            {owedTotal > 0 && <> · <b className="text-red-600">{formatMoney(owedTotal)}</b> still owed overall</>}
          </p>
        </div>
        <button onClick={openNew} className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 whitespace-nowrap" style={{ background: '#ea580c' }}>
          + New Rental
        </button>
      </div>

      {error && !showForm && !paying && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'active', 'upcoming', 'unpaid', 'paid'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${filter === f ? 'text-white' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
            style={filter === f ? { background: '#ea580c' } : {}}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Renter</th>
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-left">Dates</th>
                <th className="px-6 py-3 text-right">Days</th>
                <th className="px-6 py-3 text-right">Total</th>
                <th className="px-6 py-3 text-right">Paid</th>
                <th className="px-6 py-3 text-right">Owed</th>
                <th className="px-6 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">No rentals found.</td></tr>
              ) : filtered.map(r => {
                const due = balanceDue(Number(r.total_charge), Number(r.amount_paid))
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{r.renter?.name || '—'}</p>
                      <p className="text-gray-400 text-xs">{r.renter?.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : '—'}</td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {formatDate(r.start_date)} → {formatDate(r.end_date)}
                      {isActiveRental(r, today) && <span className="ml-2 text-[10px] font-bold uppercase text-orange-500">out</span>}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">{rentalDays(r.start_date, r.end_date)}</td>
                    <td className="px-6 py-4 text-right font-semibold text-gray-800">{formatMoney(r.total_charge)}</td>
                    <td className="px-6 py-4 text-right text-green-700">{formatMoney(r.amount_paid)}</td>
                    <td className={`px-6 py-4 text-right ${due > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}`}>{formatMoney(due)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openPayments(r)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${due > 0 ? 'bg-green-50 hover:bg-green-100 text-green-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}>
                          {due > 0 ? '＋ Payment' : 'Payments'}
                        </button>
                        <a href={`/admin/rentals/${r.id}/invoice`} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Invoice</a>
                        <button onClick={() => openEdit(r)} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Edit</button>
                        <button onClick={() => remove(r)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition">🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <UndoBar target={undo} onDone={load} onDismiss={() => setUndo(null)} />
      {/* Payments panel */}
      {paying && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 w-full sm:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-display text-2xl font-bold text-gray-800">Payments</h3>
              <button onClick={() => { setPaying(null); setError('') }} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">×</button>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              {paying.renter?.name} · {paying.vehicle ? `${paying.vehicle.make} ${paying.vehicle.model}` : 'vehicle removed'}
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6 text-center">
              <div className="bg-gray-50 rounded-xl py-3">
                <p className="text-xs text-gray-400">Total</p>
                <p className="font-bold text-gray-800">{formatMoney(paying.total_charge)}</p>
              </div>
              <div className="bg-green-50 rounded-xl py-3">
                <p className="text-xs text-gray-400">Paid</p>
                <p className="font-bold text-green-700">{formatMoney(paying.amount_paid)}</p>
              </div>
              <div className="bg-red-50 rounded-xl py-3">
                <p className="text-xs text-gray-400">Owed</p>
                <p className="font-bold text-red-600">{formatMoney(balanceDue(Number(paying.total_charge), Number(paying.amount_paid)))}</p>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <div className="border border-gray-100 rounded-2xl p-4 mb-6">
              <p className="text-sm font-semibold text-gray-700 mb-3">Record a payment</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Amount ($)</label>
                  <input type="number" min={0} step="0.01" inputMode="decimal" value={payForm.amount || ''}
                    onChange={e => setPayForm({ ...payForm, amount: num(e.target.value) })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 font-bold focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Date received</label>
                  <input type="date" value={payForm.paid_on} onChange={e => setPayForm({ ...payForm, paid_on: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-gray-500 mb-1">How was it paid?</label>
                <div className="flex gap-1 flex-wrap">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} type="button" onClick={() => setPayForm({ ...payForm, method: m })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${payForm.method === m ? 'text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                      style={payForm.method === m ? { background: '#ea580c' } : {}}>
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">The date decides which month this money counts towards in the report.</p>
              <button onClick={addPayment} disabled={payBusy || payForm.amount <= 0 || !payForm.paid_on}
                className="w-full mt-4 py-3 rounded-xl text-white font-bold disabled:opacity-50" style={{ background: '#ea580c' }}>
                {payBusy ? 'Saving…' : 'Add payment'}
              </button>
            </div>

            <p className="text-sm font-semibold text-gray-700 mb-2">Already recorded</p>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {history.map(p => (
                  <li key={p.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-semibold text-gray-800">{formatMoney(p.amount)}</p>
                      <p className="text-gray-400 text-xs">{formatDate(p.paid_on)} · {METHOD_LABELS[p.method || 'other'] || p.method}</p>
                    </div>
                    <button onClick={() => deletePayment(p)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Add / edit rental */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 md:p-8 w-full sm:max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">{editing ? 'Edit Rental' : 'New Rental'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-3xl leading-none">×</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle *</label>
                <select required value={form.vehicle_id} onChange={e => handleVehicleChange(e.target.value)} className={inputCls}>
                  <option value="">Select vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.license_plate})</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold text-gray-700">Renter *</label>
                  <button type="button" onClick={() => setAddingRenter(!addingRenter)} className="text-xs text-orange-500 hover:text-orange-600 font-medium">
                    {addingRenter ? 'Cancel' : '+ New renter'}
                  </button>
                </div>
                {addingRenter ? (
                  <div className="space-y-2 p-4 bg-orange-50 rounded-xl">
                    <input value={newRenter.name} onChange={e => setNewRenter({...newRenter, name: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Full name *" />
                    <input value={newRenter.phone} onChange={e => setNewRenter({...newRenter, phone: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Phone (optional)" />
                    <input value={newRenter.email} onChange={e => setNewRenter({...newRenter, email: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Email (optional)" />
                    <button type="button" onClick={createRenter} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: '#ea580c' }}>Add &amp; Select</button>
                  </div>
                ) : (
                  <select required value={form.renter_id} onChange={e => setForm({...form, renter_id: e.target.value})} className={inputCls}>
                    <option value="">Select renter</option>
                    {renters.map(r => <option key={r.id} value={r.id}>{r.name}{r.phone ? ` — ${r.phone}` : ''}</option>)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date *</label>
                  <input required type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End Date *</label>
                  <input required type="date" min={form.start_date || undefined} value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} className={inputCls} />
                </div>
              </div>
              {form.start_date && form.end_date && form.end_date >= form.start_date && (
                <p className="text-xs text-gray-400 -mt-2">{rentalDays(form.start_date, form.end_date)} billable day(s)</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Daily Rate ($) *</label>
                  <input required type="number" min={0} step="0.01" value={form.daily_rate} onChange={e => setForm({...form, daily_rate: num(e.target.value)})} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total Charge ($)</label>
                  <input type="number" min={0} step="0.01" value={form.total_charge} onChange={e => setForm({...form, total_charge: num(e.target.value)})} className={`${inputCls} bg-gray-50`} />
                </div>
              </div>

              {!editing && (
                <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/60">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Money received now</p>
                  <p className="text-xs text-gray-400 mb-3">Leave at zero if they are paying later. You can add payments any time.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" min={0} step="0.01" value={form.deposit || ''} onChange={e => setForm({ ...form, deposit: num(e.target.value) })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-400" placeholder="0.00" />
                    <input type="date" value={form.deposit_date} onChange={e => setForm({ ...form, deposit_date: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-400" />
                  </div>
                </div>
              )}

              {editing && (
                <p className="text-xs text-gray-400">
                  Payments are managed separately so each one keeps its own date. Close this and use the Payment button.
                </p>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className={`${inputCls} resize-none`} rows={2} />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={saving} className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50" style={{ background: '#ea580c' }}>
                {saving ? 'Saving...' : editing ? 'Update Rental' : 'Log Rental'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
