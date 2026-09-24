'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Expense, Payment, Rental, RentalRequest, Vehicle } from '@/lib/supabase'
import { balanceDue, daysPastDue, describeVehicle, formatDate, formatMoney, isActiveRental, isOverdueRental, isUpcomingRental, todayString } from '@/lib/rentals'
import {
  COST_GROUP_LABELS, CostGroup, currentMonthKey, monthEnd, monthLabel, monthStart,
  monthlyStatement, parseTaxRate, shiftMonthKey, summarise,
} from '@/lib/finance'

/**
 * The month at a glance:
 *   gross income − government tax − running costs = net profit
 *
 * Series colours are the validated categorical slots 1-4 (see the palette
 * reference); each cost group keeps its own colour whatever its size, so the
 * bar never repaints when the amounts change.
 */
const GROUP_ORDER: CostGroup[] = ['repairs', 'gasoline', 'washes', 'other']
const GROUP_COLORS: Record<CostGroup, string> = {
  repairs: 'var(--series-1)',
  gasoline: 'var(--series-2)',
  washes: 'var(--series-3)',
  other: 'var(--series-4)',
}
/** Label ink chosen per fill so the text on a segment stays readable. */
const GROUP_INK: Record<CostGroup, string> = {
  repairs: '#ffffff',
  gasoline: '#ffffff',
  washes: '#04261a',
  other: '#3a2800',
}

const TAX_RATE = parseTaxRate(process.env.NEXT_PUBLIC_TAX_RATE)

export default function AdminDashboard() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [requests, setRequests] = useState<RentalRequest[]>([])
  const [month, setMonth] = useState(currentMonthKey())
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

  const summary = useMemo(
    () => summarise({ rentals, payments, expenses, vehicles }, monthStart(month), monthEnd(month)),
    [rentals, payments, expenses, vehicles, month],
  )
  const prev = useMemo(
    () => summarise({ rentals, payments, expenses, vehicles }, monthStart(shiftMonthKey(month, -1)), monthEnd(shiftMonthKey(month, -1))),
    [rentals, payments, expenses, vehicles, month],
  )

  const st = monthlyStatement(summary, TAX_RATE)
  const prevSt = monthlyStatement(prev, TAX_RATE)
  const profitable = st.netProfit >= 0

  const today = todayString()
  const active = rentals.filter(r => isActiveRental(r, today))
  const rentedIds = new Set(active.map(r => r.vehicle_id))
  /**
   * The fleet at a glance. "Free" means not out on a rental today; whether a
   * car is listed on the public website is a separate choice with no bearing
   * on whether it is sitting in the yard, so it is shown as its own figure.
   */
  const outCars = Array.from(
    new Map(active.map(r => [r.vehicle_id ?? r.id, describeVehicle(r.vehicle, 'No vehicle recorded')])).values(),
  )
  const freeCount = vehicles.filter(v => !rentedIds.has(v.id)).length
  const listedCount = vehicles.filter(v => v.is_available).length
  const owed = rentals.reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)
  const owing = rentals
    .filter(r => balanceDue(Number(r.total_charge), Number(r.amount_paid)) > 0)
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
  /**
   * Rentals that ended without being paid off. They are in neither the "out
   * now" nor the "booked ahead" count, so the dashboard has to call them out
   * itself or they go unnoticed. Longest overdue first.
   */
  const overdue = rentals
    .filter(r => isOverdueRental(r, today))
    .sort((a, b) => a.end_date.localeCompare(b.end_date))
  const overdueTotal = overdue.reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)

  const groups = GROUP_ORDER.map(g => ({ key: g, label: COST_GROUP_LABELS[g], amount: st.costs[g] }))
  const shownGroups = groups.filter(g => g.amount > 0)
  const isCurrent = month === currentMonthKey()

  /**
   * How this month compares. A percentage across a change of sign is
   * meaningless, so those months are described in words instead.
   */
  const compare = () => {
    if (loading) return ''
    const a = st.netProfit, b = prevSt.netProfit
    if (a === 0 && b === 0) return 'Nothing recorded last month either'
    if (b === 0) return 'Nothing recorded last month'
    if ((a >= 0) !== (b >= 0)) {
      return b >= 0
        ? `Last month was a profit of ${formatMoney(b)}`
        : `Last month was a loss of ${formatMoney(Math.abs(b))}`
    }
    const pct = ((a - b) / Math.abs(b)) * 100
    if (Math.abs(pct) < 1) return `About the same as last month (${formatMoney(b)})`
    return `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct).toFixed(0)}% on last month (${formatMoney(b)})`
  }

  return (
    <div className="dk-dash p-4 md:p-8">
      <style>{`
        .dk-dash {
          --series-1: #2a78d6; /* repairs  */
          --series-2: #eb6834; /* gasoline */
          --series-3: #1baf7a; /* washes   */
          --series-4: #eda100; /* other    */
          --ink-1: var(--ink);
          --ink-2: var(--ink-2);
          --ink-3: var(--ink-3);
        }
        .dk-num { font-variant-numeric: tabular-nums; }
        @media print { .no-print { display: none !important } }
      `}</style>

      {/* Month picker */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(shiftMonthKey(month, -1))} aria-label="Previous month"
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50">‹</button>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-gray-800 px-3 min-w-[11rem] text-center">{monthLabel(month)}</h1>
          <button onClick={() => setMonth(shiftMonthKey(month, 1))} aria-label="Next month"
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 hover:bg-gray-50">›</button>
          {!isCurrent && <button onClick={() => setMonth(currentMonthKey())} className="ml-2 text-sm text-orange-500 font-medium">This month</button>}
        </div>
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">🖨️ Print</button>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* Rentals that are over and still owe money, in neither count below. */}
      {overdue.length > 0 && (
        <div className="no-print mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-red-800">
              {overdue.length === 1 ? '1 rental is' : `${overdue.length} rentals are`} past the return date and still unpaid
            </p>
            <p className="text-red-800 font-bold dk-num">{formatMoney(overdueTotal)} outstanding</p>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {overdue.slice(0, 5).map(r => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-red-900">
                <span className="font-medium">{r.renter?.name || 'Unnamed customer'}</span>
                <span className="text-red-700/70">
                  {r.vehicle ? `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}` : 'no vehicle'}
                  {' · due '}{formatDate(r.end_date)}{' · '}
                  {daysPastDue(r, today)} day{daysPastDue(r, today) === 1 ? '' : 's'} late
                </span>
                <span className="font-semibold dk-num ml-auto">
                  {formatMoney(balanceDue(Number(r.total_charge), Number(r.amount_paid)))}
                </span>
              </li>
            ))}
          </ul>
          {overdue.length > 5 && <p className="mt-2 text-xs text-red-700/70">and {overdue.length - 5} more</p>}
          <Link href="/admin/rentals" className="inline-block mt-4 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:opacity-90">
            Chase these up
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6 mb-6">
        {/* Hero: the one number the page leads with */}
        <div className="lg:col-span-2 rounded-3xl p-8 text-white flex flex-col justify-center"
          style={{ background: profitable ? 'var(--good)' : 'var(--bad)' }}>
          <p className="text-sm opacity-80">{profitable ? 'Net profit' : 'Net loss'} · {monthLabel(month)}</p>
          <p className="text-5xl md:text-6xl font-black leading-none mt-2">
            {loading ? '—' : formatMoney(Math.abs(st.netProfit))}
          </p>
          <p className="text-sm opacity-80 mt-3">
            What is left after the government&apos;s {st.taxRate}% and every running cost.
          </p>
          <p className="text-xs opacity-70 mt-1">{compare()}</p>
        </div>

        {/* The arithmetic, in the order it is read */}
        <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <h2 className="font-bold text-gray-800 mb-5">How that was worked out</h2>
          <table className="w-full text-sm dk-num">
            <tbody>
              <tr>
                <td className="py-3 text-gray-700">Gross income from all vehicles</td>
                <td className="py-3 text-right font-semibold text-gray-900">{loading ? '—' : formatMoney(st.gross)}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-3 text-gray-700">
                  Government tax
                  <span className="text-gray-400"> · {st.taxRate}% of gross</span>
                </td>
                <td className="py-3 text-right font-semibold text-red-600">− {loading ? '—' : formatMoney(st.tax)}</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="py-3 text-gray-700">
                  Cost of operation
                  <span className="text-gray-400"> · repairs, gas, washes</span>
                </td>
                <td className="py-3 text-right font-semibold text-red-600">− {loading ? '—' : formatMoney(st.costs.total)}</td>
              </tr>
              <tr className="border-t-2" style={{ borderColor: 'var(--ink-1)' }}>
                <td className="pt-4 font-bold text-gray-900">{profitable ? 'Net profit' : 'Net loss'}</td>
                <td className={`pt-4 text-right text-xl font-black ${profitable ? 'text-green-700' : 'text-red-600'}`}>
                  {loading ? '—' : formatMoney(st.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-6 rounded-2xl px-5 py-4 flex items-center justify-between gap-4" style={{ background: 'var(--brand-tint)' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--brand-tint-ink)' }}>Put aside for the government</p>
              <p className="text-xs" style={{ color: 'var(--brand-tint-ink-2)' }}>{st.taxRate}% of {formatMoney(st.gross)} received this month</p>
            </div>
            <p className="text-2xl font-black dk-num" style={{ color: 'var(--brand-tint-ink)' }}>{loading ? '—' : formatMoney(st.tax)}</p>
          </div>
        </div>
      </div>

      {/* Cost of operation */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
        <div className="flex flex-wrap justify-between items-baseline gap-2 mb-5">
          <h2 className="font-bold text-gray-800">Cost of operation</h2>
          <p className="text-2xl font-black text-gray-900 dk-num">{loading ? '—' : formatMoney(st.costs.total)}</p>
        </div>

        {st.costs.total === 0 ? (
          <p className="text-sm text-gray-400 py-4">
            No costs recorded for {monthLabel(month)}. <Link href="/admin/expenses" className="text-orange-500 font-medium">Add repairs, gas or a car wash →</Link>
          </p>
        ) : (
          <>
            {/* Part-to-whole: one stacked bar, 2px gaps, labels on any segment with room */}
            <div className="flex gap-[2px] h-11 rounded-lg overflow-hidden mb-4" role="img"
              aria-label={`Cost make-up: ${shownGroups.map(g => `${g.label} ${formatMoney(g.amount)}`).join(', ')}`}>
              {shownGroups.map(g => {
                const pct = (g.amount / st.costs.total) * 100
                return (
                  <div key={g.key} className="flex items-center justify-center overflow-hidden"
                    style={{ width: `${pct}%`, background: GROUP_COLORS[g.key] }}>
                    {pct >= 12 && (
                      <span className="text-xs font-bold px-1.5 truncate" style={{ color: GROUP_INK[g.key] }}>
                        {pct >= 26 ? `${g.label} · ` : ''}{Math.round(pct)}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend doubles as the value table, so identity is never colour alone */}
            <table className="w-full text-sm dk-num">
              <tbody>
                {groups.map(g => (
                  <tr key={g.key} className="border-t border-gray-50">
                    <td className="py-2.5 w-6">
                      <span className="inline-block w-3 h-3 rounded-sm align-middle" style={{ background: GROUP_COLORS[g.key] }} />
                    </td>
                    <td className="py-2.5 text-gray-700">{g.label}</td>
                    <td className="py-2.5 text-right text-gray-400">
                      {st.costs.total > 0 ? `${Math.round((g.amount / st.costs.total) * 100)}%` : '—'}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-gray-900 w-28">{formatMoney(g.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200">
                  <td></td>
                  <td className="pt-3 font-bold text-gray-900">Total cost of operation</td>
                  <td></td>
                  <td className="pt-3 text-right font-black text-gray-900">{formatMoney(st.costs.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-4">
              Repairs covers servicing, parts and tires. Other covers insurance, registration, towing, financing and fees.
            </p>
          </>
        )}
      </div>

      {/* Per vehicle */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap justify-between items-start gap-2">
          <div>
            <h2 className="font-bold text-gray-800">Each vehicle this month</h2>
            <p className="text-gray-400 text-xs mt-0.5">Before the government&apos;s share, which is taken off the business total</p>
          </div>
          <Link href="/admin/reports" className="no-print text-sm text-orange-500 hover:text-orange-600 font-medium whitespace-nowrap">Full report →</Link>
        </div>
        {/* Phone layout: one block per vehicle, nothing off the edge */}
        <div className="md:hidden divide-y divide-gray-100">
          {loading ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">Loading…</p>
          ) : summary.byVehicle.length === 0 ? (
            <p className="px-6 py-8 text-center text-gray-400 text-sm">No vehicles yet.</p>
          ) : summary.byVehicle.map(v => (
            <div key={v.vehicleId ?? 'none'} className="px-6 py-4">
              <p className="font-semibold text-gray-800 mb-2">
                {v.vehicleId
                  ? <Link href={`/admin/vehicles/${v.vehicleId}/log`} className="hover:text-orange-600">{v.label}</Link>
                  : v.label}
              </p>
              <dl className="text-sm dk-num space-y-1">
                <div className="flex justify-between"><dt className="text-gray-500">Income</dt><dd className="text-green-700 font-medium">{formatMoney(v.collected)}</dd></div>
                <div className="flex justify-between"><dt className="text-gray-500">Costs</dt><dd className="text-red-600 font-medium">{formatMoney(v.expenses)}</dd></div>
                <div className="flex justify-between border-t border-gray-100 pt-1">
                  <dt className="text-gray-700 font-semibold">Difference</dt>
                  <dd className={`font-bold ${v.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatMoney(v.net)}</dd>
                </div>
              </dl>
            </div>
          ))}
          {!loading && summary.byVehicle.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 text-sm dk-num space-y-1">
              <div className="flex justify-between font-semibold text-gray-800"><span>All vehicles</span><span>{formatMoney(st.gross - st.costs.total)}</span></div>
              <div className="flex justify-between text-gray-600"><span>Less government tax ({st.taxRate}%)</span><span className="text-red-600">− {formatMoney(st.tax)}</span></div>
              <div className="flex justify-between border-t border-gray-300 pt-2 font-black text-gray-900">
                <span>{profitable ? 'Net profit' : 'Net loss'}</span>
                <span className={profitable ? 'text-green-700' : 'text-red-600'}>{formatMoney(st.netProfit)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm dk-num">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-right">Income</th>
                <th className="px-6 py-3 text-right">Costs</th>
                <th className="px-6 py-3 text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : summary.byVehicle.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400">No vehicles yet.</td></tr>
              ) : summary.byVehicle.map(v => (
                <tr key={v.vehicleId ?? 'none'} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-800">
                    {v.vehicleId
                      ? <Link href={`/admin/vehicles/${v.vehicleId}/log`} className="hover:text-orange-600">{v.label}</Link>
                      : v.label}
                  </td>
                  <td className="px-6 py-3 text-right text-green-700">{formatMoney(v.collected)}</td>
                  <td className="px-6 py-3 text-right text-red-600">{formatMoney(v.expenses)}</td>
                  <td className={`px-6 py-3 text-right font-bold ${v.net >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatMoney(v.net)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200">
                <td className="px-6 py-3">All vehicles</td>
                <td className="px-6 py-3 text-right">{formatMoney(st.gross)}</td>
                <td className="px-6 py-3 text-right">{formatMoney(st.costs.total)}</td>
                <td className="px-6 py-3 text-right">{formatMoney(st.gross - st.costs.total)}</td>
              </tr>
              <tr className="bg-gray-50 text-gray-600">
                <td className="px-6 pb-2" colSpan={3}>Less government tax ({st.taxRate}% of gross)</td>
                <td className="px-6 pb-2 text-right text-red-600 font-semibold">− {formatMoney(st.tax)}</td>
              </tr>
              <tr className="bg-gray-50 font-black text-gray-900 border-t border-gray-300">
                <td className="px-6 py-3" colSpan={3}>{profitable ? 'Net profit' : 'Net loss'}</td>
                <td className={`px-6 py-3 text-right ${profitable ? 'text-green-700' : 'text-red-600'}`}>{formatMoney(st.netProfit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Day to day */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {([
          { label: 'Still owed to you', value: formatMoney(owed), sub: [`${owing.length} rental${owing.length === 1 ? '' : 's'}`], href: '/admin/rentals' },
          {
            label: 'Cars out now', value: String(outCars.length), href: '/admin/calendar',
            // Which cars are out, then the rest of the fleet.
            detail: outCars.length > 3 ? [...outCars.slice(0, 3), `+${outCars.length - 3} more`] : outCars,
            sub: [`${freeCount} free today`, `${listedCount} listed on website`],
          },
          { label: 'Upcoming rentals', value: String(rentals.filter(r => isUpcomingRental(r, today)).length), sub: ['Booked ahead'], href: '/admin/calendar' },
          { label: 'New requests', value: String(requests.length), sub: ['Awaiting review'], href: '/admin/requests' },
        ] as { label: string; value: string; sub: string[]; detail?: string[]; href: string }[]).map(card => (
          <Link key={card.label} href={card.href} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-orange-200 transition min-w-0">
            <p className="text-2xl font-black text-gray-800 dk-num">{loading ? '—' : card.value}</p>
            <p className="text-sm text-gray-600 mt-1">{card.label}</p>
            {!loading && card.detail?.map(d => (
              <p key={d} className="text-xs font-medium text-gray-700 leading-snug">{d}</p>
            ))}
            {card.sub.map(line => (
              <p key={line} className="text-xs text-gray-400">{line}</p>
            ))}
          </Link>
        ))}
      </div>

      <div className="no-print flex flex-wrap gap-3">
        <Link href="/admin/expenses" className="px-5 py-3 rounded-xl text-white text-sm font-semibold" style={{ background: '#ea580c' }}>+ Add a cost</Link>
        <Link href="/admin/rentals" className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Log a rental</Link>
        <Link href="/admin/reports" className="px-5 py-3 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">📄 Full money report</Link>
      </div>
    </div>
  )
}
