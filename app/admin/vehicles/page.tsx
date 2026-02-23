'use client'
import { useEffect, useState } from 'react'
import { supabase, Vehicle } from '@/lib/supabase'

const emptyForm = { vehicle_id: '', make: '', model: '', year: new Date().getFullYear(), color: '', license_plate: '', daily_rate: 0, is_available: true, photo_url: '', notes: '' }

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('vehicles').select('*').order('created_at')
    setVehicles(data || [])
  }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    if (editing) {
      await supabase.from('vehicles').update(form).eq('id', editing)
    } else {
      await supabase.from('vehicles').insert([form])
    }
    setSaving(false)
    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
    load()
  }

  const toggleAvailability = async (v: Vehicle) => {
    await supabase.from('vehicles').update({ is_available: !v.is_available }).eq('id', v.id)
    load()
  }

  const deleteVehicle = async (id: string) => {
    if (!confirm('Delete this vehicle? This cannot be undone.')) return
    await supabase.from('vehicles').delete().eq('id', id)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Vehicles</h1>
          <p className="text-gray-400 mt-1">Manage your fleet</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true) }}
          className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90" style={{ background: '#ea580c' }}>
          + Add Vehicle
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(v => (
          <div key={v.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden relative">
              {v.photo_url ? <img src={v.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-5xl">🚗</span>}
              <button onClick={() => toggleAvailability(v)}
                className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold text-white cursor-pointer ${v.is_available ? 'bg-green-500' : 'bg-red-500'}`}>
                {v.is_available ? '✓ Available' : '✗ Rented'}
              </button>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg text-gray-800">{v.year} {v.make} {v.model}</h3>
              <p className="text-gray-400 text-sm">{v.license_plate} {v.color ? `• ${v.color}` : ''}</p>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xl font-black text-orange-500">${v.daily_rate}<span className="text-gray-400 text-sm font-normal">/day</span></span>
                <div className="flex gap-2">
                  <button onClick={() => { setForm({ ...v, photo_url: v.photo_url || '', notes: v.notes || '', color: v.color || '' }); setEditing(v.id); setShowForm(true) }}
                    className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition">✏️ Edit</button>
                  <button onClick={() => deleteVehicle(v.id)}
                    className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-sm transition">🗑️</button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {vehicles.length === 0 && (
          <div className="col-span-3 text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">🚗</p>
            <p className="text-lg">No vehicles yet. Add your first one!</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-2xl font-bold text-gray-800">{editing ? 'Edit Vehicle' : 'Add Vehicle'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={save} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Vehicle ID *</label>
                  <input required value={form.vehicle_id} onChange={e => setForm({...form, vehicle_id: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="e.g. BH-29743" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">License Plate *</label>
                  <input required value={form.license_plate} onChange={e => setForm({...form, license_plate: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Make *</label>
                  <input required value={form.make} onChange={e => setForm({...form, make: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="Honda" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Model *</label>
                  <input required value={form.model} onChange={e => setForm({...form, model: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="Accord" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Year *</label>
                  <input required type="number" value={form.year} onChange={e => setForm({...form, year: parseInt(e.target.value)})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Color</label>
                  <input value={form.color} onChange={e => setForm({...form, color: e.target.value})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="Black" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Daily Rate ($) *</label>
                  <input required type="number" step="0.01" value={form.daily_rate} onChange={e => setForm({...form, daily_rate: parseFloat(e.target.value)})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Photo URL</label>
                <input value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 resize-none" rows={2} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="avail" checked={form.is_available} onChange={e => setForm({...form, is_available: e.target.checked})} className="w-4 h-4" />
                <label htmlFor="avail" className="text-sm font-semibold text-gray-700">Available for rent</label>
              </div>
              <button type="submit" disabled={saving}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#ea580c' }}>
                {saving ? 'Saving...' : editing ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
