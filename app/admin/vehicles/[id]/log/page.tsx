'use client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Rental, Renter, Vehicle } from '@/lib/supabase'
import { balanceDue, formatDate, formatMoney, rentalDays, todayString } from '@/lib/rentals'

/**
 * The digital version of the paper log sheet kept for each car: one row per
 * rental, in date order, with a quick-entry row at the bottom so a stack of
 * sheets can be typed up quickly.
 */

const emptyRow = { renter_name: '', renter_phone: '', start_date: '', end_date: '', total_charge: '', paid: true }

export default function VehicleLogPage() {
  const params = useParams<{ id: string }>()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [rentals, setRentals] = useState<Rental[]>([])
  const [renters, setRenters] = useState<Renter[]>([])
  const [year, setYear] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [row, setRow] = useState(emptyRow)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!params?.id) return
    try {
      const [v, r, rn] = await Promise.all([
        api.get<Vehicle>(`/api/admin/vehicles/${params.id}`),
        api.get<Rental[]>('/api/admin/rentals'),
        api.get<Renter[]>('/api/admin/renters'),
      ])
      setVehicle(v)
      setRentals(r.filter(x => x.vehicle_id === params.id))
      setRenters(rn)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the log sheet.')
    } finally {
      setLoading(false)
    }
  }, [params?.id])

  useEffect(() => { load() }, [load])

  const years = useMemo(() => {
    const set = new Set(rentals.map(r => r.start_date.slice(0, 4)))
    return Array.from(set).sort().reverse()
  }, [rentals])

  const shown = useMemo(() => {
    const list = year === 'all' ? rentals : rentals.filter(r => r.start_date.startsWith(year))
    return [...list].sort((a, b) => a.start_date.localeCompare(b.start_date))
  }, [rentals, year])

  const charged = shown.reduce((s, r) => s + Number(r.total_charge), 0)
  const collected = shown.reduce((s, r) => s + Number(r.amount_paid), 0)
  const owed = shown.reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)

  const addRow = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!params?.id) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api.post('/api/admin/log-entry', {
        vehicle_id: params.id,
        renter_name: row.renter_name,
        renter_phone: row.renter_phone || undefined,
        start_date: row.start_date,
        end_date: row.end_date,
        total_charge: Number(row.total_charge),
        paid: row.paid,
      })
      setNotice(`Added ${row.renter_name}.`)
      // Keep the dates rolling forward so the next row is quick to type.
      setRow({ ...emptyRow, start_date: row.end_date, end_date: '', paid: row.paid })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that row.')
    } finally {
      setSaving(false)
    }
  }

  const title = vehicle
    ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(' ').toUpperCase()
    : 'Log sheet'

  const cell = 'border border-gray-300 px-3 py-2'
  const inputCls = 'w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-orange-400'

  return (
    <div className="p-4 md:p-8">
      <div className="no-print flex flex-wrap justify-between items-center gap-3 mb-6">
        <Link href="/admin/vehicles" className="text-sm text-gray-500 hover:text-gray-800">← All vehicles</Link>
        <div className="flex gap-2">
          {years.length > 1 && (
            <select value={year} onChange={e => setYear(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-orange-400">
              <option value="all">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          <button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">🖨️ Print</button>
        </div>
      </div>

      {error && <div className="no-print mb-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}
      {notice && <div className="no-print mb-4 p-4 rounded-xl bg-green-50 text-green-700 text-sm">{notice}</div>}

      {/* Sheet header, matching the paper */}
      <div className="text-center mb-4">
        <div className="inline-block border border-gray-400 px-8 py-2">
          <h1 className="font-bold tracking-wide text-gray-900">
            {loading ? 'Loading…' : `${title}${vehicle?.vehicle_id ? ` # ${vehicle.vehicle_id}` : ''}`}
          </h1>
        </div>
        {vehicle && (
          <p className="text-gray-400 text-xs mt-2">
            Plate {vehicle.license_plate} · {formatMoney(vehicle.daily_rate)}/day · {year === 'all' ? 'all years' : year}
          </p>
        )}
      </div>

      <div className="overflow-x-auto bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-600">
              <th className={`${cell} text-left`}>Client name</th>
              <th className={`${cell} text-left`}>Phone</th>
              <th className={`${cell} text-left`}>From</th>
              <th className={`${cell} text-left`}>To</th>
              <th className={`${cell} text-center`}># Days</th>
              <th className={`${cell} text-right`}>Charge</th>
              <th className={`${cell} text-center`}>Paid</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className={`${cell} text-center text-gray-400`} colSpan={7}>Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td className={`${cell} text-center text-gray-400 py-8`} colSpan={7}>
                No rentals recorded for this car yet. Type the first row below.
              </td></tr>
            ) : shown.map(r => {
              const due = balanceDue(Number(r.total_charge), Number(r.amount_paid))
              return (
                <tr key={r.id} className="hover:bg-orange-50/40">
                  <td className={cell}>{r.renter?.name || '—'}</td>
                  <td className={`${cell} text-gray-500`}>{r.renter?.phone || ''}</td>
                  <td className={`${cell} whitespace-nowrap`}>{formatDate(r.start_date)}</td>
                  <td className={`${cell} whitespace-nowrap`}>{formatDate(r.end_date)}</td>
                  <td className={`${cell} text-center`}>{rentalDays(r.start_date, r.end_date)}</td>
                  <td className={`${cell} text-right font-medium`}>{formatMoney(r.total_charge)}</td>
                  <td className={`${cell} text-center`}>
                    {due <= 0
                      ? <span className="text-green-700 font-semibold">Paid</span>
                      : <span className="text-red-600 font-semibold">{formatMoney(due)} owing</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="font-bold bg-gray-50">
              <td className={cell} colSpan={4}>Total · {shown.length} rental{shown.length === 1 ? '' : 's'}</td>
              <td className={`${cell} text-center`}>{shown.reduce((s, r) => s + rentalDays(r.start_date, r.end_date), 0)}</td>
              <td className={`${cell} text-right`}>{formatMoney(charged)}</td>
              <td className={`${cell} text-center ${owed > 0 ? 'text-red-600' : 'text-green-700'}`}>
                {owed > 0 ? `${formatMoney(owed)} owing` : 'All paid'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Collected {formatMoney(collected)} of {formatMoney(charged)} charged.
      </p>

      {/* Quick entry, for typing up a paper sheet */}
      <form onSubmit={addRow} className="no-print mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="font-bold text-gray-800 mb-1">Add a row</p>
        <p className="text-gray-400 text-xs mb-4">
          Type straight off the sheet. A name that already exists is reused, a new one is added automatically.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-end">
          <div className="col-span-2 md:col-span-3">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Client name *</label>
            <input required list="renter-names" value={row.renter_name} onChange={e => setRow({ ...row, renter_name: e.target.value })}
              className={inputCls} placeholder="e.g. Stanley Mathews" />
            <datalist id="renter-names">
              {renters.map(r => <option key={r.id} value={r.name} />)}
            </datalist>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
            <input value={row.renter_phone} onChange={e => setRow({ ...row, renter_phone: e.target.value })} className={inputCls} placeholder="optional" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">From *</label>
            <input required type="date" value={row.start_date} onChange={e => setRow({ ...row, start_date: e.target.value })} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">To *</label>
            <input required type="date" min={row.start_date || undefined} value={row.end_date} onChange={e => setRow({ ...row, end_date: e.target.value })} className={inputCls} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Charge ($) *</label>
            <input required type="number" min={0} step="0.01" inputMode="decimal" value={row.total_charge}
              onChange={e => setRow({ ...row, total_charge: e.target.value })} className={`${inputCls} font-bold`} placeholder="70" />
          </div>
          <div className="md:col-span-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 pb-2">
              <input type="checkbox" checked={row.paid} onChange={e => setRow({ ...row, paid: e.target.checked })} className="w-4 h-4" />
              Paid
            </label>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-4">
          <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl text-white font-bold disabled:opacity-50" style={{ background: '#ea580c' }}>
            {saving ? 'Adding…' : 'Add row'}
          </button>
          {row.start_date && row.end_date && row.end_date >= row.start_date && (
            <span className="text-xs text-gray-400">{rentalDays(row.start_date, row.end_date)} day(s)</span>
          )}
          <button type="button" onClick={() => setRow({ ...emptyRow, start_date: todayString() })} className="text-xs text-gray-400 hover:text-gray-600 ml-auto">Clear</button>
        </div>
        {row.paid && (
          <p className="text-xs text-gray-400 mt-3">
            Marked paid records the full charge as received on the To date. Change it later in Rentals if the money came in on a different day.
          </p>
        )}
      </form>
    </div>
  )
}
