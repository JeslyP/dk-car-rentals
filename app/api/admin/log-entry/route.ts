import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isValidDateString, rentalDays, round2 } from '@/lib/rentals'
import { normaliseName } from '@/lib/validation'
import { recomputeRentalTotals } from '@/lib/payments-server'
import { RESOURCES } from '@/lib/admin-resources'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * One row of a paper log sheet, entered in a single request: find or create
 * the customer by name, create the rental, and record the payment when the
 * row is marked paid.
 *
 * Built for transcribing the existing per-vehicle sheets, where a row is
 * a name, two dates, a charge and a "Paid" mark.
 */
export async function POST(req: Request) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })

  const vehicleId = String(body.vehicle_id || '')
  const startDate = String(body.start_date || '')
  const endDate = String(body.end_date || '')
  const name = normaliseName(body.renter_name).slice(0, 120)
  const phone = typeof body.renter_phone === 'string' ? body.renter_phone.trim().slice(0, 40) : ''
  const renterId = typeof body.renter_id === 'string' ? body.renter_id : ''
  const totalCharge = typeof body.total_charge === 'number' ? body.total_charge : NaN
  const paid = body.paid === true
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : ''

  if (!UUID_RE.test(vehicleId)) return NextResponse.json({ error: 'Please choose a vehicle.' }, { status: 400 })
  if (!renterId && name.length < 2) return NextResponse.json({ error: 'Please enter the customer name.' }, { status: 400 })
  if (renterId && !UUID_RE.test(renterId)) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 })
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) return NextResponse.json({ error: 'Please enter valid From and To dates.' }, { status: 400 })
  if (endDate < startDate) return NextResponse.json({ error: 'The To date must be on or after the From date.' }, { status: 400 })
  if (!Number.isFinite(totalCharge) || totalCharge < 0) return NextResponse.json({ error: 'Please enter the charge.' }, { status: 400 })

  const paidOn = isValidDateString(body.paid_on) ? String(body.paid_on) : endDate
  const db = supabaseAdmin()

  // --- customer: use the one picked, else match an existing name, else create
  let resolvedRenterId = renterId
  if (!resolvedRenterId) {
    const { data: matches, error: lookupErr } = await db.from('renters').select('id, name, phone').ilike('name', name).limit(1)
    if (lookupErr) return NextResponse.json({ error: lookupErr.message }, { status: 500 })
    if (matches && matches.length > 0) {
      resolvedRenterId = matches[0].id
      // Fill in a phone number the sheet has but the record is missing.
      if (phone && !matches[0].phone) await db.from('renters').update({ phone }).eq('id', resolvedRenterId)
    } else {
      const { data: created, error: createErr } = await db.from('renters')
        .insert([{ name, phone: phone || null }]).select('id').single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
      resolvedRenterId = created.id
    }
  }

  // --- rental. The sheet records a total, so derive the daily rate from it.
  const days = rentalDays(startDate, endDate)
  const { data: rental, error: rentalErr } = await db.from('rentals').insert([{
    vehicle_id: vehicleId,
    renter_id: resolvedRenterId,
    start_date: startDate,
    end_date: endDate,
    daily_rate: round2(totalCharge / days),
    total_charge: round2(totalCharge),
    notes: notes || null,
  }]).select(RESOURCES.rentals.select).single()

  if (rentalErr) {
    const message = /rentals_no_overlap/.test(rentalErr.message)
      ? 'This vehicle already has a rental covering those dates. Check the sheet for a duplicate row.'
      : rentalErr.message
    return NextResponse.json({ error: message }, { status: 409 })
  }

  const rentalId = (rental as unknown as { id: string }).id
  if (paid && totalCharge > 0) {
    const { error: payErr } = await db.from('payments')
      .insert([{ rental_id: rentalId, paid_on: paidOn, amount: round2(totalCharge), method: 'cash' }])
    if (payErr) return NextResponse.json({ error: `Rental saved, but the payment failed: ${payErr.message}` }, { status: 207 })
    await recomputeRentalTotals(db, rentalId)
  }

  const { data: fresh } = await db.from('rentals').select(RESOURCES.rentals.select).eq('id', rentalId).maybeSingle()
  return NextResponse.json(fresh ?? rental, { status: 201 })
}
