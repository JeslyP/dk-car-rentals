'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Rental } from '@/lib/supabase'
import { formatMoney, rentalDays } from '@/lib/rentals'

export default function ReportsPage() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    api.get<Rental[]>('/api/admin/rentals').then(setRentals).catch(e => setError(e instanceof Error ? e.message : 'Could not load report.'))
  }, [])

  const now = new Date()
  const filterByPeriod = (r: Rental) => {
    // Attribute a rental to the period in which it starts.
    const d = new Date(r.start_date + 'T00:00:00')
    if (period === 'week') return Math.abs(now.getTime() - d.getTime()) < 7 * 86400000
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    return true
  }

  const filtered = rentals.filter(filterByPeriod)
  const totalRevenue = filtered.reduce((s, r) => s + Number(r.total_charge), 0)
  const totalCollected = filtered.reduce((s, r) => s + Number(r.amount_paid), 0)
  const totalUnpaid = Math.max(0, totalRevenue - totalCollected)
  const totalDays = filtered.reduce((s, r) => s + rentalDays(r.start_date, r.end_date), 0)
  const paidCount = filtered.filter(r => r.payment_status === 'paid').length
  const unpaidCount = filtered.filter(r => r.payment_status === 'unpaid').length
  const partialCount = filtered.filter(r => r.payment_status === 'partial').length

  const byVehicle: Record<string, { name: string, revenue: number, count: number, days: number }> = {}
  filtered.forEach(r => {
    const name = r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : 'Deleted vehicle'
    if (!byVehicle[name]) byVehicle[name] = { name, revenue: 0, count: 0, days: 0 }
    byVehicle[name].revenue += Number(r.total_charge)
    byVehicle[name].count += 1
    byVehicle[name].days += rentalDays(r.start_date, r.end_date)
  })
  const vehicleStats = Object.values(byVehicle).sort((a, b) => b.revenue - a.revenue)

  const byRenter: Record<string, { name: string, revenue: number, count: number, owed: number }> = {}
  filtered.forEach(r => {
    const name = r.renter?.name || 'Deleted renter'
    if (!byRenter[name]) byRenter[name] = { name, revenue: 0, count: 0, owed: 0 }
    byRenter[name].revenue += Number(r.total_charge)
    byRenter[name].count += 1
    byRenter[name].owed += Math.max(0, Number(r.total_charge) - Number(r.amount_paid))
  })
  const renterStats = Object.values(byRenter).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-400 mt-1">Financial overview by rental start date</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['week', 'month', 'year', 'all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${period === p ? 'text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
              style={period === p ? { background: '#ea580c' } : {}}>
              {p === 'all' ? 'All time' : p === 'week' ? 'Last 7 days' : `This ${p}`}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {[
          { label: 'Total Charged', value: formatMoney(totalRevenue), color: '#3b82f6', icon: '💵' },
          { label: 'Collected', value: formatMoney(totalCollected), color: '#10b981', icon: '✅' },
          { label: 'Outstanding', value: formatMoney(totalUnpaid), color: '#ef4444', icon: '⚠️' },
          { label: 'Rentals', value: filtered.length, color: '#ea580c', icon: '📋' },
          { label: 'Rental Days', value: totalDays, color: '#8b5cf6', icon: '📅' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <span className="text-2xl">{c.icon}</span>
            <p className="text-2xl font-black mt-2" style={{ color: c.color }}>{c.value}</p>
            <p className="text-gray-400 text-sm mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Revenue by Vehicle</h2>
          </div>
          <div className="p-6 space-y-4">
            {vehicleStats.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No data for this period</p>
            ) : vehicleStats.map(v => (
              <div key={v.name}>
                <div className="flex justify-between text-sm mb-1 gap-2">
                  <span className="font-medium text-gray-700">{v.name}</span>
                  <span className="text-gray-500 text-right">{formatMoney(v.revenue)} · {v.count} rental{v.count !== 1 ? 's' : ''} · {v.days}d</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ background: '#ea580c', width: `${totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Payment Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { label: 'Paid in full', count: paidCount, color: '#10b981' },
                { label: 'Partial', count: partialCount, color: '#f59e0b' },
                { label: 'Unpaid', count: unpaidCount, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                  <span className="font-medium text-gray-700">{s.label}</span>
                  <span className="text-2xl font-black" style={{ color: s.color }}>{s.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 rounded-xl text-white text-center" style={{ background: '#ea580c' }}>
              <p className="text-sm opacity-80">Collection rate</p>
              <p className="text-3xl font-black">{totalRevenue > 0 ? ((totalCollected / totalRevenue) * 100).toFixed(0) : 0}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Top Renters</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Renter</th>
                  <th className="px-6 py-3 text-left">Rentals</th>
                  <th className="px-6 py-3 text-left">Charged</th>
                  <th className="px-6 py-3 text-left">Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {renterStats.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No data for this period</td></tr>
                ) : renterStats.map(r => (
                  <tr key={r.name}>
                    <td className="px-6 py-3 font-medium text-gray-800">{r.name}</td>
                    <td className="px-6 py-3 text-gray-600">{r.count}</td>
                    <td className="px-6 py-3 text-gray-600">{formatMoney(r.revenue)}</td>
                    <td className={`px-6 py-3 ${r.owed > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{formatMoney(r.owed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
