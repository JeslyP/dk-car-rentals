'use client'
import { useEffect, useState } from 'react'
import { supabase, Vehicle, Renter, Rental } from '@/lib/supabase'

export default function RentalsPage() {
  const [rentals, setRentals] = useState<any[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [renters, setRenters] = useState<Renter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    vehicle_id: '', renter_id: '', start_date: '', end_date: '',
    daily_rate: 0, total_charge: 0, payment_status: 'unpaid', amount_paid: 0, notes: ''
  })
  // New renter inline
  const [newRenter, setNewRenter] = useState({ name: '', phone: '', email: '' })
  const [addingRenter, setAddingRenter] = useState(false)

  const load = async () => {
    const [r, v, rn] = await Promise.all([
      supabase.from('rentals').select('*, vehicle:vehicles(*), renter:renters(*)').order('created_at', { ascending: false }),
      supabase.from('vehicles').select('*').order('make'),
      supabase.from('renters').select('*').order('name'),
    ])
    setRentals(r.data || [])
    setVehicles(v.data || [])
    setRenters(rn.data || [])
  }
  useEffect(() => { load() }, [])

  // Auto-calculate total when dates or rate change
  useEffect(() => {
    if (form.start_date && form.end_date && form.daily_rate) {
      const days = Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000)
      if (days > 0) setForm(f => ({ ...f, total_charge: days * f.daily_rate }))
    }
  }, [form.start_date, form.end_date, form.daily_rate])

  // Auto-fill daily rate when vehicle selected
  const handleVehicleChange = (id: string) => {
    const v = vehicles.find(v => v.id === id)
    setForm(f => ({ ...f, vehicle_id: id, daily_rate: v?.daily_rate || 0 }))
  }

  const createRenter = async () => {
    if (!newRenter.name || !newRenter.phone) return
    const { data } = await supabase.from('renters').insert([newRenter]).select().single()
    if (data) {
      setRenters(prev => [...prev, data])
      setForm(f => ({ ...f, renter_id: data.id }))
      setAddingRenter(false)
      setNewRenter({ name: '', phone: '', email: '' })
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('rentals').insert([form])
    setSaving(false)
    setShowForm(false)
    load()
  }

  const updatePayment = async (id: string, status: string, amount: number) => {
    await supabase.from('rentals').update({ payment_status: status, amount_paid: amount }).eq('id', id)
    load()
  }

  const filtered = rentals.filter(r => {
    if (filter === 'unpaid') return r.payment_status === 'unpaid'
    if (filter === 'paid') return r.payment_status === 'paid'
    if (filter === 'active') return new Date(r.end_date) >= new Date()
    return true
  })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Rentals</h1>
          <p className="text-gray-400 mt-1">Log and track all rental transactions</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90" style={{ background: '#ea580c' }}>
          + New Rental
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'active', 'unpaid', 'paid'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${filter === f ? 'text-white' : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'}`}
            style={filter === f ? { background: '#ea580c' } : {}}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Renter</th>
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-left">From</th>
                <th className="px-6 py-3 text-left">To</th>
                <th className="px-6 py-3 text-left">Days</th>
                <th className="px-6 py-3 text-left">Total</th>
                <th className="px-6 py-3 text-left">Paid</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-gray-400">No rentals found.</td></tr>
              ) : filtered.map(r => {
                const days = Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000)
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-800">{r.renter?.name || '—'}</p>
                      <p className="text-gray-400 text-xs">{r.renter?.phone}</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{r.vehicle?.year} {r.vehicle?.make} {r.vehicle?.model}</td>
                    <td className="px-6 py-4 text-gray-500">{r.start_date}</td>
                    <td className="px-6 py-4 text-gray-500">{r.end_date}</td>
                    <td className="px-6 py-4 text-gray-500">{days}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">${r.total_charge}</td>
                    <td className="px-6 py-4 text-gray-600">${r.amount_paid}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        r.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                        r.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{r.payment_status}</span>
                    </td>
                    <td className="px-6 py-4">
                      {r.payment_status !== 'paid' && (
                        <button onClick={() => updatePayment(r.id, 'paid', r.total_charge)}
                          className="px-3 py-1 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg text-xs font-semibold transition">
                          Mark Paid
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Rental Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">New Rental</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              {/* Vehicle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle *</label>
                <select required value={form.vehicle_id} onChange={e => handleVehicleChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400">
                  <option value="">Select vehicle</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.year} {v.make} {v.model} ({v.license_plate})</option>
                  ))}
                </select>
              </div>

              {/* Renter */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold text-gray-700">Renter *</label>
                  <button type="button" onClick={() => setAddingRenter(!addingRenter)}
                    className="text-xs text-orange-500 hover:text-orange-600 font-medium">
                    {addingRenter ? 'Cancel' : '+ New renter'}
                  </button>
                </div>
                {addingRenter ? (
                  <div className="space-y-2 p-4 bg-orange-50 rounded-xl">
                    <input value={newRenter.name} onChange={e => setNewRenter({...newRenter, name: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Full name *" />
                    <input value={newRenter.phone} onChange={e => setNewRenter({...newRenter, phone: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Phone *" />
                    <input value={newRenter.email} onChange={e => setNewRenter({...newRenter, email: e.target.value})}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Email (optional)" />
                    <button type="button" onClick={createRenter}
                      className="px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: '#ea580c' }}>
                      Add & Select
                    </button>
                  </div>
                ) : (
                  <select required value={form.renter_id} onChange={e => setForm({...form, renter_id: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400">
                    <option value="">Select renter</option>
                    {renters.map(r => (
                      <option key={r.id} value={r.id}>{r.name} — {r.phone}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date *</label>
                  <input required type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">End Date *</label>
                  <input required type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              {/* Rate & Total */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Daily Rate ($) *</label>
                  <input required type="number" step="0.01" value={form.daily_rate} onChange={e => setForm({...form, daily_rate: parseFloat(e.target.value)})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Total Charge ($)</label>
                  <input type="number" step="0.01" value={form.total_charge} onChange={e => setForm({...form, total_charge: parseFloat(e.target.value)})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 bg-gray-50" />
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Status</label>
                  <select value={form.payment_status} onChange={e => setForm({...form, payment_status: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400">
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paid ($)</label>
                  <input type="number" step="0.01" value={form.amount_paid} onChange={e => setForm({...form, amount_paid: parseFloat(e.target.value)})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 resize-none" rows={2} />
              </div>

              <button type="submit" disabled={saving}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#ea580c' }}>
                {saving ? 'Saving...' : 'Log Rental'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
