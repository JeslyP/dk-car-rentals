'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Rental, RentalRequest, Vehicle } from '@/lib/supabase'
import { balanceDue, formatDate, formatMoney, isActiveRental, isUpcomingRental, todayString } from '@/lib/rentals'

type Stats = {
  totalVehicles: number
  availableVehicles: number
  activeRentals: number
  upcomingRentals: number
  unpaidBalance: number
  pendingRequests: number
  monthRevenue: number
}

const emptyStats: Stats = { totalVehicles: 0, availableVehicles: 0, activeRentals: 0, upcomingRentals: 0, unpaidBalance: 0, pendingRequests: 0, monthRevenue: 0 }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>(emptyStats)
  const [recentRentals, setRecentRentals] = useState<Rental[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [vehicles, rentals, requests] = await Promise.all([
          api.get<Vehicle[]>('/api/admin/vehicles'),
          api.get<Rental[]>('/api/admin/rentals'),
          api.get<RentalRequest[]>('/api/admin/requests?status=pending'),
        ])
        const today = todayString()
        const monthStart = today.slice(0, 7) + '-01'
        const active = rentals.filter(r => isActiveRental(r, today))
        const rentedIds = new Set(active.map(r => r.vehicle_id))

        setStats({
          totalVehicles: vehicles.length,
          availableVehicles: vehicles.filter(v => v.is_available && !rentedIds.has(v.id)).length,
          activeRentals: active.length,
          upcomingRentals: rentals.filter(r => isUpcomingRental(r, today)).length,
          unpaidBalance: rentals.reduce((sum, r) => sum + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0),
          pendingRequests: requests.length,
          monthRevenue: rentals.filter(r => r.created_at >= monthStart).reduce((sum, r) => sum + Number(r.amount_paid || 0), 0),
        })
        setRecentRentals([...rentals].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load dashboard.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statCards = [
    { label: 'Total Vehicles', value: stats.totalVehicles, sub: `${stats.availableVehicles} free today`, icon: '🚗', color: '#3b82f6' },
    { label: 'Active Rentals', value: stats.activeRentals, sub: `${stats.upcomingRentals} upcoming`, icon: '📋', color: '#ea580c' },
    { label: 'Unpaid Balance', value: formatMoney(stats.unpaidBalance), sub: 'Owed to you', icon: '💰', color: '#ef4444' },
    { label: 'Pending Requests', value: stats.pendingRequests, sub: 'Awaiting review', icon: '📬', color: '#8b5cf6' },
    { label: 'This Month', value: formatMoney(stats.monthRevenue), sub: 'Collected', icon: '📈', color: '#10b981' },
  ]

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-400 mt-1">Welcome back. Here&apos;s what&apos;s happening.</p>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: card.color + '22', color: card.color }}>
                {card.sub}
              </span>
            </div>
            <p className="text-2xl font-black text-gray-800">{loading ? '—' : card.value}</p>
            <p className="text-sm text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">Recent Rentals</h2>
          <a href="/admin/rentals" className="text-sm text-orange-500 hover:text-orange-600 font-medium">View all →</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Renter</th>
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-left">Dates</th>
                <th className="px-6 py-3 text-left">Charge</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {!loading && recentRentals.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No rentals yet. <a href="/admin/rentals" className="text-orange-500">Add one →</a></td></tr>
              ) : recentRentals.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-800">{r.renter?.name || 'Unknown'}</p>
                    <p className="text-gray-400 text-xs">{r.renter?.phone}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : '—'}</td>
                  <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(r.start_date)} → {formatDate(r.end_date)}</td>
                  <td className="px-6 py-4 font-medium text-gray-800">{formatMoney(r.total_charge)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      r.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                      r.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {r.payment_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
