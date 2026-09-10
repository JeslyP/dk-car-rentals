import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rentalTotal } from '@/lib/rentals'

export const dynamic = 'force-dynamic'

type Ctx = { params: { resource: string; id: string } }

/**
 * Approve a booking request and, when a vehicle was requested, turn it into a
 * rental in one step: find or create the renter by phone, then create the
 * rental at the vehicle's current daily rate. Returns the request and any
 * rental that was created.
 */
export async function POST(req: Request, { params }: Ctx) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (params.resource !== 'requests') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const createRental = body?.create_rental !== false
  const db = supabaseAdmin()

  const { data: request, error } = await db.from('rental_requests').select('*, vehicle:vehicles(*)').eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (request.status !== 'pending') return NextResponse.json({ error: 'This request has already been reviewed.' }, { status: 409 })

  let rental = null
  if (createRental && request.vehicle) {
    // Reuse an existing renter with the same phone number, otherwise create one.
    const { data: existing } = await db.from('renters').select('*').eq('phone', request.phone).limit(1).maybeSingle()
    let renterId = existing?.id
    if (!renterId) {
      const { data: created, error: renterErr } = await db.from('renters')
        .insert([{ name: request.name, phone: request.phone, email: request.email }]).select('id').single()
      if (renterErr) return NextResponse.json({ error: renterErr.message }, { status: 400 })
      renterId = created.id
    }

    const dailyRate = Number(request.vehicle.daily_rate)
    const { data: createdRental, error: rentalErr } = await db.from('rentals').insert([{
      vehicle_id: request.vehicle.id,
      renter_id: renterId,
      start_date: request.start_date,
      end_date: request.end_date,
      daily_rate: dailyRate,
      total_charge: rentalTotal(request.start_date, request.end_date, dailyRate),
      payment_status: 'unpaid',
      amount_paid: 0,
      notes: request.message ? `From online request: ${request.message}` : 'From online request',
    }]).select('*, vehicle:vehicles(*), renter:renters(*)').single()
    if (rentalErr) {
      const msg = /rentals_no_overlap/.test(rentalErr.message)
        ? 'This vehicle already has a rental overlapping those dates. Approve without creating a rental, or log it manually with different dates.'
        : rentalErr.message
      return NextResponse.json({ error: msg }, { status: 409 })
    }
    rental = createdRental
  }

  const { data: updated, error: updErr } = await db.from('rental_requests').update({ status: 'approved' }).eq('id', params.id).select('*, vehicle:vehicles(*)').single()
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ request: updated, rental })
}
