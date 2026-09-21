import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolveResource, usesSoftDelete } from '@/lib/admin-resources'
import { recomputeRentalTotals } from '@/lib/payments-server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Destroy a record for good.
 *
 * Only reachable for something already deleted, so nothing can be erased in
 * one step from the ordinary lists. This is the deliberate second action
 * behind the Removed items page.
 */
export async function DELETE(req: Request, { params }: { params: { resource: string; id: string } }) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resource = resolveResource(params.resource)
  if (!resource || !usesSoftDelete(resource) || !UUID_RE.test(params.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const db = supabaseAdmin()

  // Refuse anything still in use. Permanent deletion is only ever the second
  // step after a normal delete, never a shortcut past it.
  const { data: existing } = await db.from(resource).select('id, deleted_at').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!existing.deleted_at) {
    return NextResponse.json({ error: 'Remove this first. Only something already removed can be destroyed for good.' }, { status: 409 })
  }

  // Note the rental before the row disappears, so its totals can be corrected.
  let affectedRental: string | null = null
  if (resource === 'payments') {
    const { data } = await db.from('payments').select('rental_id').eq('id', params.id).maybeSingle()
    affectedRental = data?.rental_id ?? null
  }

  const { error } = await db.from(resource).delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (affectedRental) await recomputeRentalTotals(db, affectedRental)
  return new NextResponse(null, { status: 204 })
}
