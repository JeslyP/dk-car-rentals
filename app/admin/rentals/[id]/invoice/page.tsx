'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api-client'
import type { Payment, Rental } from '@/lib/supabase'
import { balanceDue, formatDate, formatMoney, rentalDays } from '@/lib/rentals'

const BUSINESS = {
  name: 'D&J Car Rentals',
  phone: process.env.NEXT_PUBLIC_BUSINESS_PHONE || '',
  email: process.env.NEXT_PUBLIC_BUSINESS_EMAIL || '',
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '',
}

export default function InvoicePage() {
  const params = useParams<{ id: string }>()
  const [rental, setRental] = useState<Rental | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!params?.id) return
    api.get<Rental>(`/api/admin/rentals/${params.id}`).then(setRental).catch(e => setError(e instanceof Error ? e.message : 'Could not load invoice.'))
    api.get<Payment[]>(`/api/admin/payments?rental_id=${params.id}`).then(setPayments).catch(() => setPayments([]))
  }, [params?.id])

  if (error) return <div className="p-8 text-red-600">{error} <a href="/admin/rentals" className="underline ml-2">Back</a></div>
  if (!rental) return <div className="p-8 text-gray-400">Loading invoice…</div>

  const days = rentalDays(rental.start_date, rental.end_date)
  const total = Number(rental.total_charge)
  const paid = Number(rental.amount_paid)
  const due = balanceDue(total, paid)
  const invoiceNo = `INV-${rental.id.slice(0, 8).toUpperCase()}`
  const issued = new Date(rental.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } }`}</style>

      <div className="no-print max-w-3xl mx-auto flex justify-between items-center mb-4">
        <a href="/admin/rentals" className="text-sm text-gray-500 hover:text-gray-800">← Back to rentals</a>
        <button onClick={() => window.print()} className="px-5 py-2 rounded-xl text-white font-semibold text-sm" style={{ background: '#ea580c' }}>🖨️ Print / Save as PDF</button>
      </div>

      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none rounded-2xl print:rounded-none p-8 md:p-12">
        <div className="flex flex-col sm:flex-row justify-between gap-6 border-b border-gray-200 pb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#ea580c' }}>DJ</div>
              <div>
                <p className="font-display text-2xl font-bold text-gray-900">{BUSINESS.name}</p>
                <p className="text-xs text-gray-400">Rental invoice</p>
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-4 space-y-0.5">
              {BUSINESS.address && <p>{BUSINESS.address}</p>}
              {BUSINESS.phone && <p>{BUSINESS.phone}</p>}
              {BUSINESS.email && <p>{BUSINESS.email}</p>}
            </div>
          </div>
          <div className="sm:text-right text-sm">
            <p className="text-2xl font-black text-gray-900">{invoiceNo}</p>
            <p className="text-gray-500 mt-2">Issued: {issued}</p>
            <p className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
              rental.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
              rental.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {rental.payment_status}
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-8 py-8 border-b border-gray-200 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Billed to</p>
            <p className="font-semibold text-gray-900">{rental.renter?.name || 'Unknown renter'}</p>
            {rental.renter?.phone && <p className="text-gray-600">{rental.renter.phone}</p>}
            {rental.renter?.email && <p className="text-gray-600">{rental.renter.email}</p>}
            {rental.renter?.id_number && <p className="text-gray-500">ID: {rental.renter.id_number}</p>}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Vehicle</p>
            <p className="font-semibold text-gray-900">{rental.vehicle ? `${rental.vehicle.year} ${rental.vehicle.make} ${rental.vehicle.model}` : 'Vehicle removed'}</p>
            {rental.vehicle && <p className="text-gray-600">Plate {rental.vehicle.license_plate}{rental.vehicle.color ? ` · ${rental.vehicle.color}` : ''}</p>}
            <p className="text-gray-600 mt-2">{formatDate(rental.start_date)} → {formatDate(rental.end_date)}</p>
          </div>
        </div>

        <table className="w-full text-sm mt-8">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-200">
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Days</th>
              <th className="text-right py-2">Rate</th>
              <th className="text-right py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 text-gray-800">Vehicle rental{rental.vehicle ? ` — ${rental.vehicle.year} ${rental.vehicle.make} ${rental.vehicle.model}` : ''}</td>
              <td className="py-3 text-right text-gray-600">{days}</td>
              <td className="py-3 text-right text-gray-600">{formatMoney(rental.daily_rate)}</td>
              <td className="py-3 text-right text-gray-800">{formatMoney(days * Number(rental.daily_rate))}</td>
            </tr>
            {Math.abs(days * Number(rental.daily_rate) - total) > 0.005 && (
              <tr className="border-b border-gray-100">
                <td className="py-3 text-gray-800" colSpan={3}>Adjustment</td>
                <td className="py-3 text-right text-gray-800">{formatMoney(total - days * Number(rental.daily_rate))}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex justify-end mt-6">
          <div className="w-full sm:w-64 text-sm space-y-2">
            <div className="flex justify-between text-gray-600"><span>Total</span><span>{formatMoney(total)}</span></div>
            <div className="flex justify-between text-gray-600"><span>Paid</span><span>{formatMoney(paid)}</span></div>
            <div className="flex justify-between text-lg font-black border-t border-gray-200 pt-2" style={{ color: due > 0 ? '#dc2626' : '#16a34a' }}>
              <span>Balance due</span><span>{formatMoney(due)}</span>
            </div>
          </div>
        </div>

        {payments.length > 0 && (
          <div className="mt-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Payments received</p>
            <table className="w-full">
              <tbody>
                {[...payments].reverse().map(p => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-600">{formatDate(p.paid_on)}</td>
                    <td className="py-2 text-gray-500 capitalize">{p.method || 'other'}</td>
                    <td className="py-2 text-right text-gray-800">{formatMoney(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rental.notes && (
          <div className="mt-8 text-sm">
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Notes</p>
            <p className="text-gray-700 whitespace-pre-wrap">{rental.notes}</p>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-12 text-center">Thank you for choosing {BUSINESS.name}.</p>
      </div>
    </div>
  )
}
