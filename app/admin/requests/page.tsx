'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([])

  const load = async () => {
    const { data } = await supabase.from('rental_requests')
      .select('*, vehicle:vehicles(*)')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('rental_requests').update({ status }).eq('id', id)
    load()
  }

  const pending = requests.filter(r => r.status === 'pending')
  const others = requests.filter(r => r.status !== 'pending')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-gray-800">Rental Requests</h1>
        <p className="text-gray-400 mt-1">Online booking requests from your website</p>
      </div>

      {pending.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse inline-block"></span>
            Pending ({pending.length})
          </h2>
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-orange-400">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{r.name}</h3>
                    <p className="text-gray-500 text-sm">{r.phone} {r.email ? `• ${r.email}` : ''}</p>
                    <p className="text-gray-600 mt-2">
                      <span className="font-medium">Dates:</span> {r.start_date} → {r.end_date}
                    </p>
                    {r.vehicle && (
                      <p className="text-gray-600">
                        <span className="font-medium">Vehicle:</span> {r.vehicle.year} {r.vehicle.make} {r.vehicle.model}
                      </p>
                    )}
                    {r.message && <p className="text-gray-500 text-sm mt-2 italic">"{r.message}"</p>}
                    <p className="text-gray-400 text-xs mt-2">{new Date(r.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => updateStatus(r.id, 'approved')}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition">
                      ✓ Approve
                    </button>
                    <button onClick={() => updateStatus(r.id, 'rejected')}
                      className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-sm font-semibold transition">
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
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                  <th className="px-6 py-3 text-left">Name</th>
                  <th className="px-6 py-3 text-left">Phone</th>
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
                    <td className="px-6 py-4 text-gray-500">{r.start_date} → {r.end_date}</td>
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
      )}

      {requests.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📬</p>
          <p className="text-lg">No requests yet. They'll appear here when customers submit from your website.</p>
        </div>
      )}
    </div>
  )
}
