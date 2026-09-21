'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Vehicle } from '@/lib/supabase'
import { formatMoney } from '@/lib/rentals'
import { shrinkImage } from '@/lib/image-client'
import { humanSize, validateImageUpload } from '@/lib/upload'

const emptyForm = { vehicle_id: '', make: '', model: '', year: new Date().getFullYear(), color: '', license_plate: '', daily_rate: 0, is_available: true, photo_url: '', notes: '' }
type Form = typeof emptyForm

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Form>(emptyForm)
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadNote, setUploadNote] = useState('')

  const load = async () => {
    try { setVehicles(await api.get<Vehicle[]>('/api/admin/vehicles')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load vehicles.') }
  }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await api.patch(`/api/admin/vehicles/${editing}`, form)
      else await api.post('/api/admin/vehicles', form)
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save vehicle.')
    } finally {
      setSaving(false)
    }
  }

  const toggleAvailability = async (v: Vehicle) => {
    try {
      await api.patch(`/api/admin/vehicles/${v.id}`, { is_available: !v.is_available })
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update vehicle.') }
  }

  const deleteVehicle = async (id: string) => {
    if (!confirm('Delete this vehicle? Past rentals will keep their records but lose the vehicle link. This cannot be undone.')) return
    try {
      await api.delete(`/api/admin/vehicles/${id}`)
      await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete vehicle.') }
  }

  const startEdit = (v: Vehicle) => {
    setForm({ vehicle_id: v.vehicle_id, make: v.make, model: v.model, year: v.year, color: v.color || '', license_plate: v.license_plate, daily_rate: Number(v.daily_rate), is_available: v.is_available, photo_url: v.photo_url || '', notes: v.notes || '' })
    setEditing(v.id)
    setError('')
    setUploadNote('')
    setShowForm(true)
  }

  const num = (v: string) => (v === '' ? 0 : Number(v))

  /** Shrink the picture in the browser, then send it to the upload route. */
  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0]
    e.target.value = '' // let the same file be chosen again after a failure
    if (!chosen) return

    setUploading(true)
    setError('')
    setUploadNote('')
    try {
      const ready = await shrinkImage(chosen)
      const check = validateImageUpload({ type: ready.type, size: ready.size })
      if (!check.ok) {
        setError(check.error)
        return
      }

      const body = new FormData()
      body.append('file', ready)
      const res = await fetch('/api/admin/upload', { method: 'POST', body, credentials: 'same-origin' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not upload that photo.')
        return
      }

      setForm(f => ({ ...f, photo_url: data.url }))
      setUploadNote(ready.size < chosen.size
        ? `Uploaded, shrunk from ${humanSize(chosen.size)} to ${humanSize(ready.size)}.`
        : 'Uploaded.')
    } catch {
      setError('Could not upload that photo. Check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Vehicles</h1>
          <p className="text-gray-400 mt-1">Manage your fleet</p>
        </div>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setError(''); setUploadNote(''); setShowForm(true) }}
          className="px-5 py-3 rounded-xl text-white font-semibold transition hover:opacity-90 whitespace-nowrap" style={{ background: '#ea580c' }}>
          + Add Vehicle
        </button>
      </div>

      {error && !showForm && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vehicles.map(v => (
          <div key={v.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="h-40 bg-gray-100 flex items-center justify-center overflow-hidden relative">
              {v.photo_url ? <img src={v.photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-5xl">🚗</span>}
              <button onClick={() => toggleAvailability(v)} title="Toggle whether this vehicle is listed for rent"
                className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold text-white cursor-pointer ${v.is_available ? 'bg-green-500' : 'bg-red-500'}`}>
                {v.is_available ? '✓ Listed' : '✗ Not listed'}
              </button>
            </div>
            <div className="p-5">
              <h3 className="font-bold text-lg text-gray-800">{v.year} {v.make} {v.model}</h3>
              <p className="text-gray-400 text-sm">#{v.vehicle_id} · {v.license_plate} {v.color ? `• ${v.color}` : ''}</p>
              <div className="flex justify-between items-center mt-4">
                <span className="text-xl font-black text-orange-500">{formatMoney(v.daily_rate)}<span className="text-gray-400 text-sm font-normal">/day</span></span>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(v)} className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm transition">✏️ Edit</button>
                  <button onClick={() => deleteVehicle(v.id)} className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-sm transition">🗑️</button>
                </div>
              </div>
              <a href={`/admin/vehicles/${v.id}/log`}
                className="block mt-4 text-center py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
                📋 Log sheet
              </a>
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

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
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
                  <input required type="number" min={1900} max={2100} value={form.year} onChange={e => setForm({...form, year: num(e.target.value)})}
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
                  <input required type="number" min={0} step="0.01" value={form.daily_rate} onChange={e => setForm({...form, daily_rate: num(e.target.value)})}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Photo</label>
                <div className="flex items-start gap-4">
                  <div className="w-28 h-20 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {form.photo_url
                      ? <img src={form.photo_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-3xl">🚗</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className={`inline-block px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition ${uploading ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                      {uploading ? 'Uploading…' : form.photo_url ? 'Replace photo' : '📷 Choose a photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="hidden"
                        disabled={uploading} onChange={pickPhoto} />
                    </label>
                    {form.photo_url && !uploading && (
                      <button type="button" onClick={() => { setForm({ ...form, photo_url: '' }); setUploadNote('') }}
                        className="ml-2 px-3 py-2.5 rounded-xl text-sm text-red-500 hover:bg-red-50 transition">Remove</button>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Take one on your phone or pick from your photos. It is shrunk automatically before uploading.
                    </p>
                    {uploadNote && <p className="text-xs text-green-600 mt-1">{uploadNote}</p>}
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Or paste a link to a photo</summary>
                  <input type="url" value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})}
                    className="w-full mt-2 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 text-sm" placeholder="https://..." />
                </details>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-orange-400 resize-none" rows={2} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="avail" checked={form.is_available} onChange={e => setForm({...form, is_available: e.target.checked})} className="w-4 h-4" />
                <label htmlFor="avail" className="text-sm font-semibold text-gray-700">Listed for rent on the website</label>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={saving || uploading}
                className="w-full py-4 rounded-xl text-white font-bold text-lg transition hover:opacity-90 disabled:opacity-50"
                style={{ background: '#ea580c' }}>
                {saving ? 'Saving...' : uploading ? 'Waiting for the photo…' : editing ? 'Update Vehicle' : 'Add Vehicle'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
