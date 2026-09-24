'use client'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Rental, Vehicle } from '@/lib/supabase'
import { addDays, describeVehicle, formatDate, formatMoney, parseDate, todayString, toDateString, vehicleColour, vehicleName } from '@/lib/rentals'

/** First and last day of the month containing `d` (YYYY-MM-DD). */
function monthBounds(d: string): { start: string; end: string } {
  const date = parseDate(d)
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return { start: toDateString(start), end: toDateString(end) }
}

function shiftMonth(d: string, delta: number): string {
  const date = parseDate(d)
  return toDateString(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)))
}

export default function CalendarPage() {
  const today = todayString()
  const [cursor, setCursor] = useState(today)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Rental | null>(null)

  const { start, end } = useMemo(() => monthBounds(cursor), [cursor])

  useEffect(() => {
    Promise.all([
      api.get<Vehicle[]>('/api/admin/vehicles'),
      api.get<Rental[]>(`/api/admin/rentals?from=${start}&to=${end}`),
    ]).then(([v, r]) => { setVehicles(v); setRentals(r) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load calendar.'))
  }, [start, end])

  const days = useMemo(() => {
    const out: string[] = []
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
    return out
  }, [start, end])

  const monthLabel = parseDate(start).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const rentalsFor = (vehicleId: string) => rentals.filter(r => r.vehicle_id === vehicleId)
  const unassigned = rentals.filter(r => !r.vehicle_id || !vehicles.some(v => v.id === r.vehicle_id))

  /** Position of a rental bar inside the month, clipped to its edges. */
  const barStyle = (r: Rental) => {
    const s = r.start_date < start ? start : r.start_date
    const e = r.end_date > end ? end : r.end_date
    const from = days.indexOf(s)
    const to = days.indexOf(e)
    return { gridColumn: `${from + 1} / ${to + 2}` }
  }

  const colour = (r: Rental) =>
    r.payment_status === 'paid' ? '#10b981' : r.payment_status === 'partial' ? '#f59e0b' : '#ea580c'

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Calendar</h1>
          <p className="text-gray-400 mt-1">Who has which vehicle, day by day</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(shiftMonth(cursor, -1))} className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50">‹</button>
          <button onClick={() => setCursor(today)} className="px-4 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium">Today</button>
          <button onClick={() => setCursor(shiftMonth(cursor, 1))} className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50">›</button>
          <span className="font-bold text-gray-800 ml-2 whitespace-nowrap">{monthLabel}</span>
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      <div className="flex gap-4 text-xs text-gray-500 mb-3">
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded" style={{ background: '#ea580c' }} /> Unpaid</span>
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded" style={{ background: '#f59e0b' }} /> Partial</span>
        <span className="flex items-center gap-1"><i className="inline-block w-3 h-3 rounded" style={{ background: '#10b981' }} /> Paid</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        <div style={{ minWidth: `${160 + days.length * 34}px` }}>
          {/* Header row */}
          <div className="flex border-b border-gray-100 sticky top-0 bg-white z-10">
            <div className="w-40 flex-shrink-0 px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Vehicle</div>
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(34px, 1fr))` }}>
              {days.map(d => {
                const date = parseDate(d)
                const weekend = [0, 6].includes(date.getUTCDay())
                return (
                  <div key={d} className={`text-center py-2 border-l border-gray-50 ${d === today ? 'bg-orange-50' : weekend ? 'bg-gray-50' : ''}`}>
                    <p className="text-[10px] text-gray-400">{date.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' })}</p>
                    <p className={`text-xs font-semibold ${d === today ? 'text-orange-600' : 'text-gray-700'}`}>{date.getUTCDate()}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {vehicles.length === 0 && !error && (
            <p className="px-6 py-10 text-center text-gray-400">No vehicles yet.</p>
          )}

          {vehicles.map(v => {
            const rows = rentalsFor(v.id)
            return (
              <div key={v.id} className="flex border-b border-gray-50 hover:bg-gray-50/50">
                <div className="w-40 flex-shrink-0 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-800 truncate">{vehicleName(v)}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {[vehicleColour(v), v.license_plate].filter(Boolean).join(' · ')}{!v.is_available ? ' · not listed' : ''}
                  </p>
                </div>
                <div className="flex-1 relative grid items-center py-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(34px, 1fr))`, minHeight: 56 }}>
                  {days.map(d => (
                    <div key={d} className={`absolute top-0 bottom-0 border-l border-gray-50 ${d === today ? 'bg-orange-50/60' : ''}`}
                      style={{ left: `${(days.indexOf(d) / days.length) * 100}%`, width: `${100 / days.length}%` }} />
                  ))}
                  {rows.map(r => (
                    <button key={r.id} onClick={() => setSelected(r)} style={{ ...barStyle(r), background: colour(r) }}
                      title={`${r.renter?.name || 'Unknown'} · ${formatDate(r.start_date)} → ${formatDate(r.end_date)}`}
                      className="relative z-[1] mx-0.5 my-0.5 h-7 rounded-md text-white text-xs font-semibold px-2 truncate text-left hover:opacity-90">
                      {r.renter?.name || 'Unknown'}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {unassigned.length > 0 && (
            <div className="flex border-b border-gray-50">
              <div className="w-40 flex-shrink-0 px-4 py-3">
                <p className="text-sm font-semibold text-gray-500">Deleted vehicles</p>
              </div>
              <div className="flex-1 grid items-center py-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(34px, 1fr))`, minHeight: 56 }}>
                {unassigned.map(r => (
                  <button key={r.id} onClick={() => setSelected(r)} style={{ ...barStyle(r), background: '#9ca3af' }}
                    className="mx-0.5 my-0.5 h-7 rounded-md text-white text-xs font-semibold px-2 truncate text-left">
                    {r.renter?.name || 'Unknown'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-display text-xl font-bold text-gray-800">{selected.renter?.name || 'Unknown renter'}</h3>
                <p className="text-gray-400 text-sm">{selected.renter?.phone}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between"><dt className="text-gray-500">Vehicle</dt><dd className="font-medium text-gray-800">{describeVehicle(selected.vehicle)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Dates</dt><dd className="font-medium text-gray-800">{formatDate(selected.start_date)} → {formatDate(selected.end_date)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Total</dt><dd className="font-medium text-gray-800">{formatMoney(selected.total_charge)}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Paid</dt><dd className="font-medium text-gray-800">{formatMoney(selected.amount_paid)} <span className="text-xs text-gray-400">({selected.payment_status})</span></dd></div>
              {selected.notes && <div><dt className="text-gray-500">Notes</dt><dd className="text-gray-700 mt-1">{selected.notes}</dd></div>}
            </dl>
            <div className="flex gap-2 mt-6">
              <a href={`/admin/rentals/${selected.id}/invoice`} className="flex-1 text-center py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50">Invoice</a>
              <a href="/admin/rentals" className="flex-1 text-center py-3 rounded-xl text-white font-semibold text-sm" style={{ background: '#ea580c' }}>Open rentals</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
