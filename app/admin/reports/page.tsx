'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import type { Expense, Payment, Rental, Vehicle } from '@/lib/supabase'
import { formatDate, formatMoney } from '@/lib/rentals'
import {
  COST_GROUP_LABELS, CostGroup, currentMonthKey, monthEnd, monthLabel, monthStart,
  monthlyStatement, parseTaxRate, shiftMonthKey, shortMonthLabel, statementCsv, summarise,
} from '@/lib/finance'

const TAX_RATE = parseTaxRate(process.env.NEXT_PUBLIC_TAX_RATE)
const GROUP_ORDER: CostGroup[] = ['repairs', 'gasoline', 'washes', 'other']

type Scope = 'month' | 'year' | 'all'

export default function ReportsPage() {
  const [rentals, setRentals] = useState<Rental[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<Scope>('month')
  const [month, setMonth] = useState(currentMonthKey())

  useEffect(() => {
    Promise.all([
      api.get<Rental[]>('/api/admin/rentals'),
      api.get<Payment[]>('/api/admin/payments'),
      api.get<Expense[]>('/api/admin/expenses'),
      api.get<Vehicle[]>('/api/admin/vehicles'),
    ]).then(([r, p, e, v]) => { setRentals(r); setPayments(p); setExpenses(e); setVehicles(v) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the report.'))
      .finally(() => setLoading(false))
  }, [])

  const { from, to, title } = useMemo(() => {
    if (scope === 'all') return { from: '0000-01-01', to: '9999-12-31', title: 'All time' }
    if (scope === 'year') {
      const year = month.slice(0, 4)
      return { from: `${year}-01-01`, to: `${year}-12-31`, title: year }
    }
    return { from: monthStart(month), to: monthEnd(month), title: monthLabel(month) }
  }, [scope, month])

  const summary = useMemo(
    () => summarise({ rentals, payments, expenses, vehicles }, from, to),
    [rentals, payments, expenses, vehicles, from, to],
  )

  const st = monthlyStatement(summary, TAX_RATE)

  const downloadCsv = () => {
    const blob = new Blob([`﻿${statementCsv(summary, title, TAX_RATE)}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dj-statement-${scope === 'all' ? 'all-time' : scope === 'year' ? month.slice(0, 4) : month}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const profitable = st.netProfit >= 0
  const monthsToShow = scope === 'month' ? [] : summary.byMonth.filter(m => m.collected || m.expenses)

  return (
    <div className="p-4 md:p-8">
      <style>{`@media print {
        .no-print { display: none !important }
        body { background: #fff }
        .print-plain { box-shadow: none !important; border-color: #e5e7eb !important }
      }`}</style>

      <div className="flex flex-col md:flex-row justify-between md:items-start gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">Money report</h1>
          <p className="text-gray-400 mt-1">What came in, what went out, and what is left</p>
        </div>
        <div className="no-print flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">🖨️ Print</button>
          <button onClick={downloadCsv} className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">⬇ Export CSV</button>
          <a href="/api/admin/backup" download
            title="A complete copy of every record, to keep somewhere safe like Google Drive"
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">🗄️ Full backup</a>
        </div>
      </div>

      {error && <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>}

      {/* Period picker */}
      <div className="no-print bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['month', 'year', 'all'] as const).map(s => (
            <button key={s} onClick={() => setScope(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${scope === s ? 'text-white' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              style={scope === s ? { background: '#ea580c' } : {}}>
              {s === 'all' ? 'All time' : s === 'month' ? 'By month' : 'By year'}
            </button>
          ))}
        </div>
        {scope !== 'all' && (
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth(shiftMonthKey(month, scope === 'year' ? -12 : -1))} className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100">‹</button>
            <span className="font-semibold text-gray-800 text-sm min-w-[8rem] text-center">{title}</span>
            <button onClick={() => setMonth(shiftMonthKey(month, scope === 'year' ? 12 : 1))} className="px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100">›</button>
          </div>
        )}
        {scope !== 'all' && month !== currentMonthKey() && (
          <button onClick={() => setMonth(currentMonthKey())} className="text-sm text-orange-500 font-medium">Back to now</button>
        )}
      </div>

      <p className="text-sm text-gray-500 mb-4">
        Showing <b className="text-gray-700">{title}</b>
        {scope !== 'all' && <> · {formatDate(from)} to {formatDate(to)}</>}
      </p>

      {/* Headline statement: gross − tax − costs = net */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 mb-4 print-plain">
        <table className="w-full text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <tbody>
            <tr>
              <td className="py-2.5 text-gray-700">Gross income from all vehicles</td>
              <td className="py-2.5 text-right text-gray-400 text-xs">{summary.paymentCount} payment{summary.paymentCount === 1 ? '' : 's'}</td>
              <td className="py-2.5 text-right font-semibold text-gray-900 w-32">{loading ? '—' : formatMoney(st.gross)}</td>
            </tr>
            <tr className="border-t border-gray-100">
              <td className="py-2.5 text-gray-700">Government tax</td>
              <td className="py-2.5 text-right text-gray-400 text-xs">{st.taxRate}% of gross</td>
              <td className="py-2.5 text-right font-semibold text-red-600">− {loading ? '—' : formatMoney(st.tax)}</td>
            </tr>
            <tr className="border-t border-gray-100">
              <td className="py-2.5 text-gray-700">Cost of operation</td>
              <td className="py-2.5 text-right text-gray-400 text-xs">{summary.expenseCount} entr{summary.expenseCount === 1 ? 'y' : 'ies'}</td>
              <td className="py-2.5 text-right font-semibold text-red-600">− {loading ? '—' : formatMoney(st.costs.total)}</td>
            </tr>
            <tr className="border-t-2 border-gray-800">
              <td className="pt-4 font-bold text-gray-900">{profitable ? 'Net profit' : 'Net loss'}</td>
              <td className="pt-4 text-right text-gray-400 text-xs">{st.gross > 0 ? `${(st.margin * 100).toFixed(0)}% of gross` : ''}</td>
              <td className={`pt-4 text-right text-2xl font-black ${profitable ? 'text-green-700' : 'text-red-600'}`}>
                {loading ? '—' : formatMoney(st.netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="mt-5 grid sm:grid-cols-4 gap-3 text-sm border-t border-gray-100 pt-4">
          {GROUP_ORDER.map(g => (
            <div key={g}>
              <p className="text-gray-400 text-xs">{COST_GROUP_LABELS[g]}</p>
              <p className="font-semibold text-gray-800" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(st.costs[g])}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Accrual side note */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-8 print-plain">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Invoiced for rentals starting in this period</p>
            <p className="text-xl font-bold text-gray-800 mt-0.5">{formatMoney(summary.charged)}</p>
            <p className="text-gray-400 text-xs mt-1">{summary.rentalCount} rental{summary.rentalCount === 1 ? '' : 's'}</p>
          </div>
          <div>
            <p className="text-gray-400">Of that, still owed to you</p>
            <p className={`text-xl font-bold mt-0.5 ${summary.outstanding > 0 ? 'text-red-600' : 'text-gray-800'}`}>{formatMoney(summary.outstanding)}</p>
            <p className="text-gray-400 text-xs mt-1">Chase these up in the Rentals page</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-4 border-t border-gray-100 pt-3">
          The profit figure above counts money on the date it was actually received, which is what you normally report for tax.
          The invoiced figure counts the full price of rentals that started in the period, paid or not.
          Tax is worked out at {st.taxRate}% of the gross income received; change it with the NEXT_PUBLIC_TAX_RATE setting.
        </p>
      </div>

      {/* Per vehicle */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6 print-plain">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">Each vehicle</h2>
          <p className="text-gray-400 text-xs mt-0.5">Money received on that car, minus what it cost to run</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Vehicle</th>
                <th className="px-6 py-3 text-right">Rentals</th>
                <th className="px-6 py-3 text-right">Received</th>
                <th className="px-6 py-3 text-right">Costs</th>
                <th className="px-6 py-3 text-right">Profit</th>
                <th className="px-6 py-3 text-right">Still owed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">Loading…</td></tr>
              ) : summary.byVehicle.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">No vehicles yet.</td></tr>
              ) : summary.byVehicle.map(v => (
                <tr key={v.vehicleId ?? 'none'} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">
                    {v.vehicleId
                      ? <Link href={`/admin/vehicles/${v.vehicleId}/log`} className="hover:text-orange-600">{v.label}</Link>
                      : v.label}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-500">{v.rentals}</td>
                  <td className="px-6 py-4 text-right text-green-700">{formatMoney(v.collected)}</td>
                  <td className="px-6 py-4 text-right text-red-600">{formatMoney(v.expenses)}</td>
                  <td className={`px-6 py-4 text-right font-bold ${v.net >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatMoney(v.net)}</td>
                  <td className={`px-6 py-4 text-right ${v.outstanding > 0 ? 'text-red-500' : 'text-gray-300'}`}>{formatMoney(v.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            {summary.byVehicle.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-800">
                  <td className="px-6 py-3">Total</td>
                  <td className="px-6 py-3 text-right">{summary.rentalCount}</td>
                  <td className="px-6 py-3 text-right">{formatMoney(summary.collected)}</td>
                  <td className="px-6 py-3 text-right">{formatMoney(summary.expenses)}</td>
                  <td className="px-6 py-3 text-right">{formatMoney(summary.net)}</td>
                  <td className="px-6 py-3 text-right">{formatMoney(summary.outstanding)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category split */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print-plain">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">What the costs were</h2>
          </div>
          <div className="p-6 space-y-3">
            {summary.byCategory.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No costs recorded for this period. <Link href="/admin/expenses" className="text-orange-500">Add some →</Link></p>
            ) : summary.byCategory.map(c => (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{c.label}</span>
                  <span className="text-gray-500">{formatMoney(c.amount)} · {(c.share * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-red-400" style={{ width: `${c.share * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Month by month, when looking at a year or all time */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print-plain">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Month by month</h2>
          </div>
          {scope === 'month' ? (
            <p className="p-6 text-sm text-gray-400">Switch to <b>By year</b> above to compare months.</p>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-gray-500 text-xs uppercase tracking-wide">
                    <th className="px-6 py-3 text-left">Month</th>
                    <th className="px-6 py-3 text-right">Received</th>
                    <th className="px-6 py-3 text-right">Costs</th>
                    <th className="px-6 py-3 text-right">Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {monthsToShow.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Nothing recorded yet.</td></tr>
                  ) : monthsToShow.map(m => (
                    <tr key={m.month} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-700">{shortMonthLabel(m.month)}</td>
                      <td className="px-6 py-3 text-right text-green-700">{formatMoney(m.collected)}</td>
                      <td className="px-6 py-3 text-right text-red-600">{formatMoney(m.expenses)}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${m.net >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{formatMoney(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-8 text-center">
        D&amp;J Car Rentals · {title} · printed {new Date().toLocaleDateString()}
      </p>
    </div>
  )
}
