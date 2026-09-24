'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Payment, Renter, Rental } from '@/lib/supabase'
import {
  balanceDue, daysPastDue, describeVehicle, formatDate, formatMoney, isOverdueRental, rentalDays, todayString,
} from '@/lib/rentals'

/**
 * One customer's account: every rental they have taken, every payment they
 * have made, and what is left over. Printable, so it can be handed to them.
 */
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', transfer: 'Transfer', card: 'Card', cheque: 'Cheque', other: 'Other',
}

export default function RenterStatementPage() {
  const params = useParams<{ id: string }>()
  const [renter, setRenter] = useState<Renter | null>(null)
  const [rentals, setRentals] = useState<Rental[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!params?.id) return
    try {
      const [rn, rt, pm] = await Promise.all([
        api.get<Renter>(`/api/admin/renters/${params.id}`),
        api.get<Rental[]>('/api/admin/rentals'),
        api.get<Payment[]>('/api/admin/payments'),
      ])
      setRenter(rn)
      setRentals(rt.filter(r => r.renter_id === params.id))
      setPayments(pm.filter(p => p.rental?.renter_id === params.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this statement.')
    } finally {
      setLoading(false)
    }
  }, [params?.id])

  useEffect(() => { load() }, [load])

  const today = todayString()

  const ordered = useMemo(
    () => [...rentals].sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [rentals],
  )
  const orderedPayments = useMemo(
    () => [...payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on)),
    [payments],
  )

  const charged = rentals.reduce((s, r) => s + Number(r.total_charge), 0)
  const paid = rentals.reduce((s, r) => s + Number(r.amount_paid), 0)
  const owed = rentals.reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)
  const overdue = rentals
    .filter(r => isOverdueRental(r, today))
    .reduce((s, r) => s + balanceDue(Number(r.total_charge), Number(r.amount_paid)), 0)

  const carOf = (r: Rental) => describeVehicle(r.vehicle)

  if (loading) return <div className="p-8 text-gray-400">Loading…</div>
  if (error) return <div className="p-8"><div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div></div>
  if (!renter) return <div className="p-8 text-gray-400">That customer could not be found.</div>

  return (
    <div className="p-4 md:p-8">
      <style>{`
        .dk-num { font-variant-numeric: tabular-nums; }
        @media print { .no-print { display: none !important } }
      `}</style>

      <div className="no-print mb-4">
        <a href="/admin/renters" className="text-sm text-orange-500 hover:text-orange-600 font-medium">← All renters</a>
      </div>

      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-800">{renter.name}</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {[renter.phone, renter.email, renter.id_number].filter(Boolean).join(' · ') || 'No contact details on file'}
          </p>
        </div>
        <button onClick={() => window.print()}
          className="no-print px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">
          🖨️ Print
        </button>
      </div>

      {/* Where this customer stands */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-6">
        <table className="w-full text-sm dk-num">
          <tbody>
            <tr>
              <td className="py-3 text-gray-700">Charged over {rentals.length} rental{rentals.length === 1 ? '' : 's'}</td>
              <td className="py-3 text-right font-semibold text-gray-900">{formatMoney(charged)}</td>
            </tr>
            <tr className="border-t border-gray-100">
              <td className="py-3 text-gray-700">Paid over {payments.length} payment{payments.length === 1 ? '' : 's'}</td>
              <td className="py-3 text-right font-semibold text-green-700">− {formatMoney(paid)}</td>
            </tr>
            <tr className="border-t-2 border-gray-300">
              <td className="pt-4 font-bold text-gray-900">{owed > 0 ? 'Still owes' : 'Settled up'}</td>
              <td className={`pt-4 text-right text-2xl font-black ${owed > 0 ? 'text-red-600' : 'text-green-700'}`}>{formatMoney(owed)}</td>
            </tr>
          </tbody>
        </table>
        {overdue > 0 && (
          <p className="mt-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            <b className="dk-num">{formatMoney(overdue)}</b> of that is on rentals whose return date has already passed.
          </p>
        )}
      </div>

      {/* Rentals */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <h2 className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800">Rentals</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Vehicle</th>
                <th className="px-4 py-3 text-right">Days</th>
                <th className="px-4 py-3 text-right">Charged</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Owed</th>
                <th className="px-4 py-3 text-left no-print"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ordered.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">No rentals yet.</td></tr>
              ) : ordered.map(r => {
                const due = balanceDue(Number(r.total_charge), Number(r.amount_paid))
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-gray-500 whitespace-nowrap">
                      {formatDate(r.start_date)} → {formatDate(r.end_date)}
                      {isOverdueRental(r, today) && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase whitespace-nowrap">
                          overdue {daysPastDue(r, today)}d
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 whitespace-nowrap">{carOf(r)}</td>
                    <td className="px-4 py-4 text-right text-gray-500 dk-num">{rentalDays(r.start_date, r.end_date)}</td>
                    <td className="px-4 py-4 text-right text-gray-700 dk-num">{formatMoney(r.total_charge)}</td>
                    <td className="px-4 py-4 text-right text-green-700 dk-num">{formatMoney(r.amount_paid)}</td>
                    <td className={`px-4 py-4 text-right dk-num ${due > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}`}>{formatMoney(due)}</td>
                    <td className="px-4 py-4 no-print">
                      <a href={`/admin/rentals/${r.id}/invoice`} className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition whitespace-nowrap">Invoice</a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {ordered.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200 dk-num">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right">{formatMoney(charged)}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(paid)}</td>
                  <td className={`px-4 py-3 text-right ${owed > 0 ? 'text-red-600' : ''}`}>{formatMoney(owed)}</td>
                  <td className="px-4 py-3 no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Payments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <h2 className="px-6 py-4 border-b border-gray-100 font-bold text-gray-800">Payments received</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">For</th>
                <th className="px-6 py-3 text-left">Method</th>
                <th className="px-6 py-3 text-left">Note</th>
                <th className="px-6 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orderedPayments.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No payments recorded yet.</td></tr>
              ) : orderedPayments.map(p => {
                const r = rentals.find(x => x.id === p.rental_id)
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{formatDate(p.paid_on)}</td>
                    <td className="px-6 py-4 text-gray-500">{r ? `${carOf(r)} (${formatDate(r.start_date)})` : '—'}</td>
                    <td className="px-6 py-4 text-gray-500">{p.method ? METHOD_LABELS[p.method] ?? p.method : '—'}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs">{p.notes || ''}</td>
                    <td className="px-6 py-4 text-right font-semibold text-green-700 dk-num">{formatMoney(p.amount)}</td>
                  </tr>
                )
              })}
            </tbody>
            {orderedPayments.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 font-bold text-gray-900 border-t border-gray-200">
                  <td className="px-6 py-3" colSpan={4}>Total received</td>
                  <td className="px-6 py-3 text-right dk-num">{formatMoney(orderedPayments.reduce((s, p) => s + Number(p.amount), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
