import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RESOURCES, resolveResource } from '@/lib/admin-resources'
import { pickWritable, validateWrite } from '@/lib/validation'

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

  // Optional filters used by the admin pages.
  const status = url.searchParams.get('status')
  if (status && resource === 'rental_requests') query = query.eq('status', status)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  if (resource === 'rentals' && from && to) query = query.lte('start_date', to).gte('end_date', from)

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

  const { data: row, error } = await supabaseAdmin().from(resource).insert([data]).select(RESOURCES[resource].select).single()
  if (error) return NextResponse.json({ error: friendlyDbError(error.message) }, { status: 400 })
  return NextResponse.json(row, { status: 201 })
}
