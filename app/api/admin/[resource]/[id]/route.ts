import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RESOURCES, resolveResource, usesSoftDelete } from '@/lib/admin-resources'
import { pickWritable, validateWrite } from '@/lib/validation'
import { recomputeRentalTotals } from '@/lib/payments-server'

export const dynamic = 'force-dynamic'

type Ctx = { params: { resource: string; id: string } }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function friendlyDbError(message: string): string {
  if (/duplicate key/.test(message)) return 'That record already exists.'
  if (/rentals_no_overlap/.test(message)) return 'This vehicle already has a rental that overlaps those dates.'
  if (/rentals_dates_check/.test(message)) return 'The end date must be on or after the start date.'
  return message
}

export async function GET(req: Request, { params }: Ctx) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resource = resolveResource(params.resource)
  if (!resource || !UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data, error } = await supabaseAdmin().from(resource).select(RESOURCES[resource].select).eq('id', params.id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resource = resolveResource(params.resource)
  if (!resource || !UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const data = pickWritable(resource, body)
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  const invalid = validateWrite(resource, data, true)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data: row, error } = await supabaseAdmin().from(resource).update(data).eq('id', params.id).select(RESOURCES[resource].select).maybeSingle()
  if (error) return NextResponse.json({ error: friendlyDbError(error.message) }, { status: 400 })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

/**
 * Removes a record from view. For anything holding financial history the row
 * is only marked, so a mis-tap can be undone and nothing the business may
 * need later is destroyed.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resource = resolveResource(params.resource)
  if (!resource || !UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const db = supabaseAdmin()

  if (!usesSoftDelete(resource)) {
    const { error } = await db.from(resource).delete().eq('id', params.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return new NextResponse(null, { status: 204 })
  }

  const { data, error } = await db.from(resource)
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id).is('deleted_at', null).select('id').maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // A removed payment changes what its rental has been paid.
  if (resource === 'payments') {
    const { data: row } = await db.from('payments').select('rental_id').eq('id', params.id).maybeSingle()
    if (row?.rental_id) await recomputeRentalTotals(db, row.rental_id)
  }

  return NextResponse.json({ id: data.id, restorable: true })
}
