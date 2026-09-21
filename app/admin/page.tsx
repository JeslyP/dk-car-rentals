'use client'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Expense, Payment, Rental, RentalRequest, Vehicle } from '@/lib/supabase'
import { balanceDue, formatDate, formatMoney, isActiveRental, isUpcomingRental, todayString } from '@/lib/rentals'
import { CATEGORY_LABELS, currentMonthKey, monthEnd, monthLabel, monthStart, shiftMonthKey, summarise } from '@/lib/finance'

export default function AdminDashboard() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api.get<Rental[]>('/api/admin/rentals'),
      api.get<Payment[]>('/api/admin/payments'),
      api.get<Expense[]>('/api/admin/expenses'),
      api.get<Vehicle[]>('/api/admin/vehicles'),
      api.get<RentalRequest[]>('/api/admin/requests?status=pending'),
    ]).then(([r, p, e, v, q]) => { setRentals(r); setPayments(p); setExpenses(e); setVehicles(v); setRequests(q) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the dashboard.'))
      .finally(() => setLoading(false))
  }, [])

  const thisMonth = currentMonthKey()
  const lastMonth = shiftMonthKey(thisMonth, -1)

  const now = useMemo(
    () => summarise({ rentals, payments, expenses, vehicles }, monthStart(thisMonth), monthEnd(thisMonth)),
    [rentals, payments, expenses, vehicles, thisMonth],
  )
  const prev = useMemo(
    () => summarise({ rentals, payments, expenses, vehicles }, monthStart(lastMonth), monthEnd(lastMonth)),
    [rentals, payments, expenses, vehicles, lastMonth],
  )

  const today = todayString()
  const active = rentals.filter(r => isActiveRental(r, today))
  const rentedIds = new Set(active.map(r => r.vehicle_id))
  const freeToday = vehicles.filter(v => v.is_available && !rentedIds.has(v.id)).length
  const owed = rentals.reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)
  const owing = rentals
    .filter(r => balanceDue(Number(r.total_charge), Number(r.amount_paid)) > 0)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
    .slice(0, 5)

  const recentPayments = [...payments].slice(0, 5)
  const recentExpenses = [...expenses].slice(0, 5)

  const delta = (a: number, b: number) => {
    if (b === 0) return a > 0 ? 'new this month' : 'same as last month'
    const pct = ((a - b) / Math.abs(b)) * 100
    if (Math.abs(pct) < 1) return 'about the same as last month'
    return `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}% vs last month`
  }

  const profitable = now.net >= 0

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-gray-800">{monthLabel(thisMonth)}</h1>
        <p className="text-gray-400 mt-1">How the business is doing this month</p>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* This month's money */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">Money received</p>
          <p className="text-3xl font-black text-green-600 mt-1">{loading ? '—' : formatMoney(now.collected)}</p>
          <p className="text-gray-400 text-xs mt-1">{loading ? '' : delta(now.collected, prev.collected)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">Costs paid</p>
          <p className="text-3xl font-black text-red-600 mt-1">{loading ? '—' : formatMoney(now.expenses)}</p>
          <p className="text-gray-400 text-xs mt-1">{loading ? '' : delta(now.expenses, prev.expenses)}</p>
        </div>
        <div className="rounded-2xl p-6 shadow-sm text-white" style={{ background: profitable ? '#15803d' : '#b91c1c' }}>
          <p className="opacity-80 text-sm">Profit so far</p>
          <p className="text-3xl font-black mt-1">{loading ? '—' : formatMoney(now.net)}</p>
          <p className="opacity-80 text-xs mt-1">
            Last month {formatMoney(prev.net)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <a href="/admin/expenses" className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: '#ea580c' }}>+ Add a cost</a>
        <a href="/admin/rentals" className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Log a rental</a>
        <a href="/admin/reports" className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">📄 Full money report</a>
      </div>

      {/* Operational strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Still owed to you', value: formatMoney(owed), sub: `${owing.length} rental${owing.length === 1 ? '' : 's'}`, color: owed > 0 ? '#ef4444' : '#9ca3af', icon: '⏳' },
          { label: 'Cars out now', value: active.length, sub: `${freeToday} free today`, color: '#ea580c', icon: '🚗' },
          { label: 'Upcoming rentals', value: rentals.filter(r => isUpcomingRental(r, today)).length, sub: 'Booked ahead', color: '#3b82f6', icon: '📅' },
          { label: 'New requests', value: requests.length, sub: 'Awaiting review', color: '#8b5cf6', icon: '📬' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: card.color + '22', color: card.color }}>{card.sub}</span>
            </div>
            <p className="text-2xl font-black text-gray-800">{loading ? '—' : card.value}</p>
            <p className="text-sm text-gray-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Best and worst earners this month */}
      {!loading && now.byVehicle.some(v => v.collected || v.expenses) && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="font-bold text-gray-800">Each car this month</h2>
            <a href="/admin/reports" className="text-sm text-orange-500 hover:text-orange-600 font-medium">Full report →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Vehicle</th>
                  <th className="px-6 py-3 text-right">Received</th>
                  <th className="px-6 py-3 text-right">Costs</th>
                  <th className="px-6 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {now.byVehicle.map(v => (
                  <tr key={v.vehicleId ?? 'none'} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-800">{v.label}</td>
                    <td className="px-6 py-3 text-right text-green-700">{formatMoney(v.collected)}</td>
                    <td className="px-6 py-3 text-right text-red-600">{formatMoney(v.expenses)}</td>
                    <td className={`px-6 py-3 text-right font-bold ${v.net >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatMoney(v.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Who owes money */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Waiting on payment</h2>
          </div>
          {owing.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">{loading ? 'Loading…' : 'Everyone is paid up. 🎉'}</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {owing.map(r => (
                <li key={r.id} className="px-6 py-3 flex justify-between items-center">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{r.renter?.name || 'Unknown'}</p>
                    <p className="text-gray-400 text-xs">ended {formatDate(r.end_date)}</p>
                  </div>
                  <span className="font-bold text-red-600 ml-3">{formatMoney(balanceDue(Number(r.total_charge), Number(r.amount_paid)))}</span>
                </li>
              ))}
            </ul>
          )}
          <a href="/admin/rentals" className="block px-6 py-3 text-sm text-orange-500 hover:text-orange-600 font-medium border-t border-gray-50">Record a payment →</a>
        </div>

        {/* Recent money in */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Latest money in</h2>
          </div>
          {recentPayments.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">{loading ? 'Loading…' : 'No payments recorded yet.'}</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentPayments.map(p => (
                <li key={p.id} className="px-6 py-3 flex justify-between items-center">
                  <p className="text-gray-500 text-sm">{formatDate(p.paid_on)}</p>
                  <span className="font-bold text-green-700">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent money out */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Latest money out</h2>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">{loading ? 'Loading…' : 'No costs recorded yet.'}</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentExpenses.map(e => (
                <li key={e.id} className="px-6 py-3 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-gray-700 text-sm truncate">{CATEGORY_LABELS[e.category as never] || e.category}</p>
                    <p className="text-gray-400 text-xs truncate">{formatDate(e.spent_on)}{e.vehicle ? ` · ${e.vehicle.make} ${e.vehicle.model}` : ''}</p>
                  </div>
                  <span className="font-bold text-red-600">{formatMoney(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <a href="/admin/expenses" className="block px-6 py-3 text-sm text-orange-500 hover:text-orange-600 font-medium border-t border-gray-50">Add a cost →</a>
        </div>
      </div>
    </div>
  )
}
