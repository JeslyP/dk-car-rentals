'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ReportsPage() {
  const [rentals, setRentals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')

  useEffect(() => {
    supabase.from('rentals').select('*, vehicle:vehicles(*), renter:renters(*)').then(({ data }) => {
      setRentals(data || [])
      setLoading(false)
    })
  }, [])

  const now = new Date()
  const filterByPeriod = (r: any) => {
    const d = new Date(r.created_at)
    if (period === 'week') return now.getTime() - d.getTime() < 7 * 86400000
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    if (period === 'year') return d.getFullYear() === now.getFullYear()
    return true
  }

  const filtered = rentals.filter(filterByPeriod)
  const totalRevenue = filtered.reduce((s, r) => s + r.total_charge, 0)
  const totalCollected = filtered.reduce((s, r) => s + r.amount_paid, 0)
  const totalUnpaid = totalRevenue - totalCollected
  const paidCount = filtered.filter(r => r.payment_status === 'paid').length
  const unpaidCount = filtered.filter(r => r.payment_status === 'unpaid').length

  // Revenue by vehicle
  const byVehicle: Record<string, { name: string, revenue: number, count: number }> = {}
  filtered.forEach(r => {
    const name = r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : 'Unknown'
    if (!byVehicle[name]) byVehicle[name] = { name, revenue: 0, count: 0 }
    byVehicle[name].revenue += r.total_charge
    byVehicle[name].count += 1
  })
  const vehicleStats = Object.values(byVehicle).sort((a, b) => b.revenue - a.revenue)

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-400 mt-1">Financial overview & rental history</p>
        </div>
        <div className="flex gap-2">
          {['week', 'month', 'year', 'all'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition ${period === p ? 'text-white' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
              style={period === p ? { background: '#ea580c' } : {}}>
              {p === 'all' ? 'All time' : `This ${p}`}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Total Charged', value: `$${totalRevenue.toFixed(2)}`, color: '#3b82f6', icon: '💵' },
          { label: 'Collected', value: `$${totalCollected.toFixed(2)}`, color: '#10b981', icon: '✅' },
          { label: 'Outstanding', value: `$${totalUnpaid.toFixed(2)}`, color: '#ef4444', icon: '⚠️' },
          { label: 'Rentals', value: filtered.length, color: '#ea580c', icon: '📋' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <span className="text-2xl">{c.icon}</span>
            <p className="text-2xl font-black mt-2" style={{ color: c.color }}>{c.value}</p>
            <p className="text-gray-400 text-sm mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By vehicle */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Revenue by Vehicle</h2>
          </div>
          <div className="p-6 space-y-4">
            {vehicleStats.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No data for this period</p>
            ) : vehicleStats.map(v => (
              <div key={v.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{v.name}</span>
                  <span className="text-gray-500">${v.revenue.toFixed(2)} · {v.count} rental{v.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ background: '#ea580c', width: `${(v.revenue / totalRevenue) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Payment Breakdown</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[
                { label: 'Paid in full', count: paidCount, color: '#10b981' },
                { label: 'Unpaid', count: unpaidCount, color: '#ef4444' },
                { label: 'Partial', count: filtered.filter(r => r.payment_status === 'partial').length, color: '#f59e0b' },
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
      </div>
    </div>
  )
}
