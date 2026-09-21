import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { pickWritable, validateWrite } from '@/lib/validation'
import { recomputeRentalTotals } from '@/lib/payments-server'
import { RESOURCES } from '@/lib/admin-resources'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** List payments. Optional ?rental_id=, or ?from=&to= for reports. */
export async function GET(req: Request) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(req.url)
  let query = supabaseAdmin().from('payments').select(RESOURCES.payments.select)
    .is('deleted_at', null)
    .order('paid_on', { ascending: false })

  const rentalId = url.searchParams.get('rental_id')
  if (rentalId) {
    if (!UUID_RE.test(rentalId)) return NextResponse.json({ error: 'Invalid rental id.' }, { status: 400 })
    query = query.eq('rental_id', rentalId)
  }
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (from) query = query.gte('paid_on', from)
  if (to) query = query.lte('paid_on', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/** Record a payment against a rental. */
export async function POST(req: Request) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const data = pickWritable('payments', body)
  const invalid = validateWrite('payments', data, false)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const db = supabaseAdmin()
  const rentalId = String(data.rental_id)
  if (!UUID_RE.test(rentalId)) return NextResponse.json({ error: 'Invalid rental id.' }, { status: 400 })

  const { data: rental } = await db.from('rentals').select('id').eq('id', rentalId).maybeSingle()
  if (!rental) return NextResponse.json({ error: 'That rental no longer exists.' }, { status: 404 })

  const { data: row, error } = await db.from('payments').insert([data]).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await recomputeRentalTotals(db, rentalId)
  return NextResponse.json(row, { status: 201 })
}
