import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RESOURCES, resolveResource, usesSoftDelete } from '@/lib/admin-resources'
import { pickWritable, validateWrite } from '@/lib/validation'
import { recomputeRentalTotals } from '@/lib/payments-server'
import { isValidDateString } from '@/lib/rentals'

export const dynamic = 'force-dynamic'

type Ctx = { params: { resource: string } }

function friendlyDbError(message: string): string {
  if (/duplicate key/.test(message)) {
    if (/license_plate/.test(message)) return 'A vehicle with that license plate already exists.'
    if (/vehicle_id/.test(message)) return 'A vehicle with that Vehicle ID already exists.'
    return 'That record already exists.'
  }
  if (/rentals_no_overlap/.test(message)) return 'This vehicle already has a rental that overlaps those dates.'
  if (/rentals_dates_check/.test(message)) return 'The end date must be on or after the start date.'
  return message
}

export async function GET(req: Request, { params }: Ctx) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resource = resolveResource(params.resource)
  if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cfg = RESOURCES[resource]
  const url = new URL(req.url)
  let query = supabaseAdmin().from(resource).select(cfg.select).order(cfg.order.column, { ascending: cfg.order.ascending })
  // Deleted rows stay in the database but never appear in the admin.
  if (usesSoftDelete(resource)) query = query.is('deleted_at', null)

  // Optional filters used by the admin pages.
  const status = url.searchParams.get('status')
  if (status && resource === 'rental_requests') query = query.eq('status', status)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  // Rentals overlapping the window (used by the calendar), but expenses that
  // fall inside it (used by the reports).
  if (resource === 'rentals' && from && to) query = query.lte('start_date', to).gte('end_date', from)
  if (resource === 'expenses') {
    if (from) query = query.gte('spent_on', from)
    if (to) query = query.lte('spent_on', to)
    const vehicle = url.searchParams.get('vehicle_id')
    if (vehicle) query = query.eq('vehicle_id', vehicle)
    const category = url.searchParams.get('category')
    if (category) query = query.eq('category', category)
    // Bills still to pay, whatever month they are dated in.
    if (url.searchParams.get('unpaid') === '1') query = query.eq('is_paid', false)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request, { params }: Ctx) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resource = resolveResource(params.resource)
  if (!resource || resource === 'rental_requests') return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const data = pickWritable(resource, body)
  const invalid = validateWrite(resource, data, false)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const db = supabaseAdmin()
  const { data: row, error } = await db.from(resource).insert([data]).select(RESOURCES[resource].select).single()
  if (error) return NextResponse.json({ error: friendlyDbError(error.message) }, { status: 400 })

  // A new rental may come with money already received. Record it as a dated
  // payment so it lands in the right month's income.
  if (resource === 'rentals' && row && typeof row === 'object' && 'id' in row) {
    const initial = (body as Record<string, unknown> | null)?.initial_payment as Record<string, unknown> | undefined
    const amount = typeof initial?.amount === 'number' ? initial.amount : 0
    if (amount > 0) {
      const paidOn = isValidDateString(initial?.paid_on) ? String(initial.paid_on) : String(data.start_date)
      const method = typeof initial?.method === 'string' ? initial.method : 'cash'
      const rentalId = String((row as { id: string }).id)
      const { error: payErr } = await db.from('payments').insert([{ rental_id: rentalId, paid_on: paidOn, amount, method }])
      if (!payErr) await recomputeRentalTotals(db, rentalId)
    }
  }

  return NextResponse.json(row, { status: 201 })
}
