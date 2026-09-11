'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Vehicle, Renter, Rental } from '@/lib/supabase'
import { balanceDue, formatDate, formatMoney, isActiveRental, isUpcomingRental, paymentStatusFor, rentalDays, rentalTotal, todayString } from '@/lib/rentals'

const emptyForm = {
  vehicle_id: '', renter_id: '', start_date: '', end_date: '',
  daily_rate: 0, total_charge: 0, payment_status: 'unpaid' as Rental['payment_status'], amount_paid: 0, notes: ''
}
type Form = typeof emptyForm

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
  const [paying, setPaying] = useState<Rental | null>(null)
  const [payAmount, setPayAmount] = useState(0)
  const [newRenter, setNewRenter] = useState({ name: '', phone: '', email: '' })
  const [addingRenter, setAddingRenter] = useState(false)

  const load = async () => {
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
  }
  useEffect(() => { load() }, [])

  // Auto-calculate total when dates or rate change
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
    if (!newRenter.name || !newRenter.phone) return
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

  const openNew = () => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (r: Rental) => {
    setForm({
      vehicle_id: r.vehicle_id || '', renter_id: r.renter_id || '', start_date: r.start_date, end_date: r.end_date,
      daily_rate: Number(r.daily_rate), total_charge: Number(r.total_charge), payment_status: r.payment_status,
      amount_paid: Number(r.amount_paid), notes: r.notes || '',
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
      const payload = { ...form, payment_status: paymentStatusFor(form.total_charge, form.amount_paid) }
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

  const recordPayment = async () => {
    if (!paying) return
    const amount = Math.min(Number(paying.total_charge), Number(paying.amount_paid) + payAmount)
    try {
      await api.patch(`/api/admin/rentals/${paying.id}`, { amount_paid: amount, payment_status: paymentStatusFor(Number(paying.total_charge), amount) })
      setPaying(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record payment.')
    }
  }

  const remove = async (r: Rental) => {
    if (!confirm('Delete this rental record? This cannot be undone.')) return
    try {
      await api.delete(`/api/admin/rentals/${r.id}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete rental.')
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

  const num = (v: string) => (v === '' ? 0 : Number(v))
  const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400'

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Rentals</h1>
          <p className="text-gray-400 mt-1">Log and track all rental transactions</p>
        </div>
        <button onClick={openNew} className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 whitespace-nowrap" style={{ background: '#ea580c' }}>
          + New Rental
        </button>
      </div>

      {error && !showForm && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

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
                <th className="px-6 py-3 text-left">Days</th>
                <th className="px-6 py-3 text-left">Total</th>
                <th className="px-6 py-3 text-left">Balance</th>
                <th className="px-6 py-3 text-left">Status</th>
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
                    <td className="px-6 py-4 text-gray-500">{rentalDays(r.start_date, r.end_date)}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{formatMoney(r.total_charge)}</td>
                    <td className={`px-6 py-4 ${due > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{formatMoney(due)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        r.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                        r.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{r.payment_status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {r.payment_status !== 'paid' && (
                          <button onClick={() => { setPaying(r); setPayAmount(due) }}
                            className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-xs font-semibold transition">
                            Payment
                          </button>
                        )}
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

      {/* Record payment modal */}
      {paying && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl">
            <h3 className="font-display text-2xl font-bold text-gray-800 mb-1">Record Payment</h3>
            <p className="text-gray-400 text-sm mb-6">{paying.renter?.name} · balance {formatMoney(balanceDue(Number(paying.total_charge), Number(paying.amount_paid)))}</p>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount received ($)</label>
            <input type="number" min={0} step="0.01" value={payAmount} onChange={e => setPayAmount(num(e.target.value))} className={inputCls} autoFocus />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setPaying(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">Cancel</button>
              <button onClick={recordPayment} disabled={payAmount <= 0} className="flex-1 py-3 rounded-xl text-white font-bold disabled:opacity-50" style={{ background: '#ea580c' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add / edit rental modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">{editing ? 'Edit Rental' : 'New Rental'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
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
                    <input value={newRenter.phone} onChange={e => setNewRenter({...newRenter, phone: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Phone *" />
                    <input value={newRenter.email} onChange={e => setNewRenter({...newRenter, email: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Email (optional)" />
                    <button type="button" onClick={createRenter} className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: '#ea580c' }}>Add & Select</button>
                  </div>
                ) : (
                  <select required value={form.renter_id} onChange={e => setForm({...form, renter_id: e.target.value})} className={inputCls}>
                    <option value="">Select renter</option>
                    {renters.map(r => <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>)}
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

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paid ($)</label>
                <input type="number" min={0} step="0.01" value={form.amount_paid} onChange={e => setForm({...form, amount_paid: num(e.target.value)})} className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">Status will be <b>{paymentStatusFor(form.total_charge, form.amount_paid)}</b></p>
              </div>

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
