import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { RESOURCES, resolveResource, usesSoftDelete } from '@/lib/admin-resources'
import { recomputeRentalTotals } from '@/lib/payments-server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Put back something that was deleted. This is what Undo calls. */
export async function POST(req: Request, { params }: { params: { resource: string; id: string } }) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = resolveResource(params.resource)
  if (!resource || !usesSoftDelete(resource) || !UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db.from(resource)
    .update({ deleted_at: null }).eq('id', params.id).select(RESOURCES[resource].select).maybeSingle()

  if (error) {
    // Something else may have taken the slot while this was out of the way.
    const message =
      /vehicles_license_plate_live_idx/.test(error.message) ? 'Another vehicle now uses that license plate, so this one cannot come back as it was.'
      : /vehicles_vehicle_id_live_idx/.test(error.message) ? 'Another vehicle now uses that Vehicle ID, so this one cannot come back as it was.'
      : /rentals_no_overlap/.test(error.message) ? 'That vehicle now has another rental covering those dates, so this one cannot come back.'
      : error.message
    return NextResponse.json({ error: message }, { status: 409 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (resource === 'payments') {
    const { data: row } = await db.from('payments').select('rental_id').eq('id', params.id).maybeSingle()
    if (row?.rental_id) await recomputeRentalTotals(db, row.rental_id)
  }

  return NextResponse.json(data)
}
