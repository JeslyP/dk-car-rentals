'use client'
import { useEffect, useState } from 'react'
import { supabase, Renter } from '@/lib/supabase'

export default function RentersPage() {
  const [renters, setRenters] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', id_number: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('renters').select('*, rentals(count)').order('name')
    setRenters(data || [])
  }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await supabase.from('renters').insert([form])
    setSaving(false)
    setShowForm(false)
    setForm({ name: '', phone: '', email: '', id_number: '' })
    load()
  }

  const filtered = renters.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone.includes(search)
  )

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Renters</h1>
          <p className="text-gray-400 mt-1">Manage your customer database</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90" style={{ background: '#ea580c' }}>
          + Add Renter
        </button>
      </div>

      <div className="mb-6">
        <input value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 bg-white"
          placeholder="🔍 Search by name or phone..." />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Phone</th>
              <th className="px-6 py-3 text-left">Email</th>
              <th className="px-6 py-3 text-left">ID Number</th>
              <th className="px-6 py-3 text-left">Member Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No renters found.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-800">{r.name}</td>
                <td className="px-6 py-4 text-gray-600">{r.phone}</td>
                <td className="px-6 py-4 text-gray-500">{r.email || '—'}</td>
                <td className="px-6 py-4 text-gray-500">{r.id_number || '—'}</td>
                <td className="px-6 py-4 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">Add Renter</h3>
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
                <input required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
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
              <button type="submit" disabled={saving}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90"
                style={{ background: '#ea580c' }}>
                {saving ? 'Saving...' : 'Add Renter'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
