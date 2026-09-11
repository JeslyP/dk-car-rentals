'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Rental, RentalRequest } from '@/lib/supabase'
import { formatDate, rentalDays } from '@/lib/rentals'

export default function RequestsPage() {
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try { setRequests(await api.get<RentalRequest[]>('/api/admin/requests')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load requests.') }
  }
  useEffect(() => { load() }, [])

  const approve = async (r: RentalRequest, createRental: boolean) => {
    if (createRental && !confirm(`Approve and create a rental for ${r.name} (${r.vehicle?.year} ${r.vehicle?.make} ${r.vehicle?.model}, ${formatDate(r.start_date)} → ${formatDate(r.end_date)})?`)) return
    setBusy(r.id)
    setError('')
    setNotice('')
    try {
      const res = await api.post<{ rental: Rental | null }>(`/api/admin/requests/${r.id}/approve`, { create_rental: createRental })
      setNotice(res.rental ? `Approved and logged as a rental for ${r.name}.` : `Approved ${r.name}'s request.`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not approve request.')
    } finally {
      setBusy(null)
    }
  }

  const reject = async (r: RentalRequest) => {
    setBusy(r.id)
    setError('')
    try {
      await api.patch(`/api/admin/requests/${r.id}`, { status: 'rejected' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update request.')
    } finally {
      setBusy(null)
    }
  }

  const pending = requests.filter(r => r.status === 'pending')
  const others = requests.filter(r => r.status !== 'pending')

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-gray-800">Rental Requests</h1>
        <p className="text-gray-400 mt-1">Online booking requests from your website</p>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      {notice && <div className="mb-6 p-4 rounded-xl bg-green-50 text-green-700 text-sm">{notice}</div>}

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse inline-block"></span>
            Pending ({pending.length})
          </h2>
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-orange-400">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{r.name}</h3>
                    <p className="text-gray-500 text-sm">
                      <a href={`tel:${r.phone}`} className="hover:text-orange-500">{r.phone}</a>
                      {r.email ? <> • <a href={`mailto:${r.email}`} className="hover:text-orange-500">{r.email}</a></> : ''}
                    </p>
                    <p className="text-gray-600 mt-2">
                      <span className="font-medium">Dates:</span> {formatDate(r.start_date)} → {formatDate(r.end_date)} ({rentalDays(r.start_date, r.end_date)} day{rentalDays(r.start_date, r.end_date) === 1 ? '' : 's'})
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Vehicle:</span> {r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : 'Any available vehicle'}
                    </p>
                    {r.message && <p className="text-gray-500 text-sm mt-2 italic">&ldquo;{r.message}&rdquo;</p>}
                    <p className="text-gray-400 text-xs mt-2">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap md:flex-nowrap md:ml-4">
                    {r.vehicle && (
                      <button onClick={() => approve(r, true)} disabled={busy === r.id}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap">
                        ✓ Approve & log rental
                      </button>
                    )}
                    <button onClick={() => approve(r, false)} disabled={busy === r.id}
                      className="px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-sm font-semibold transition disabled:opacity-50 whitespace-nowrap">
                      ✓ Approve only
                    </button>
                    <button onClick={() => reject(r)} disabled={busy === r.id}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-sm font-semibold transition disabled:opacity-50">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-700 mb-4">History</h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Phone</th>
                    <th className="px-6 py-3 text-left">Vehicle</th>
                    <th className="px-6 py-3 text-left">Dates</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {others.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-800">{r.name}</td>
                      <td className="px-6 py-4 text-gray-500">{r.phone}</td>
                      <td className="px-6 py-4 text-gray-500">{r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : 'Any'}</td>
                      <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(r.start_date)} → {formatDate(r.end_date)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {requests.length === 0 && !error && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📬</p>
          <p className="text-lg">No requests yet. They&apos;ll appear here when customers submit from your website.</p>
        </div>
      )}
    </div>
  )
}
