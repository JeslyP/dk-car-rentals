'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Renter } from '@/lib/supabase'

const emptyForm = { name: '', phone: '', email: '', id_number: '' }

export default function RentersPage() {
  const [renters, setRenters] = useState<Renter[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try { setRenters(await api.get<Renter[]>('/api/admin/renters')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load renters.') }
  }
  useEffect(() => { load() }, [])

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

  const remove = async (r: Renter) => {
    if (!confirm(`Delete ${r.name}? Their rentals will keep their records but lose the renter link.`)) return
    try {
      await api.delete(`/api/admin/renters/${r.id}`)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete renter.') }
  }

  const q = search.trim().toLowerCase()
  const filtered = renters.filter(r =>
    r.name.toLowerCase().includes(q) || r.phone.includes(q) || (r.email || '').toLowerCase().includes(q)
  )
  const rentalCount = (r: Renter) => r.rentals?.[0]?.count ?? 0

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Renters</h1>
          <p className="text-gray-400 mt-1">Manage your customer database</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setError(''); setShowForm(true) }}
          className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 whitespace-nowrap" style={{ background: '#ea580c' }}>
          + Add Renter
        </button>
      </div>

      {error && !showForm && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 bg-white"
          placeholder="🔍 Search by name, phone or email..." />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Name</th>
                <th className="px-6 py-3 text-left">Phone</th>
                <th className="px-6 py-3 text-left">Email</th>
                <th className="px-6 py-3 text-left">ID Number</th>
                <th className="px-6 py-3 text-left">Rentals</th>
                <th className="px-6 py-3 text-left">Member Since</th>
                <th className="px-6 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">No renters found.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{r.name}</td>
                  <td className="px-6 py-4 text-gray-600">{r.phone}</td>
                  <td className="px-6 py-4 text-gray-500">{r.email || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{r.id_number || '—'}</td>
                  <td className="px-6 py-4 text-gray-500">{rentalCount(r)}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <button onClick={() => { setForm({ name: r.name, phone: r.phone, email: r.email || '', id_number: r.id_number || '' }); setEditing(r.id); setError(''); setShowForm(true) }}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition">Edit</button>
                      <button onClick={() => remove(r)} className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg text-xs font-semibold transition">🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone *</label>
                <input required type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
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
