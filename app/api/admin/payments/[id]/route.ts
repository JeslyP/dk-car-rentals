import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recomputeRentalTotals } from '@/lib/payments-server'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Remove a payment, for example one entered by mistake. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!UUID_RE.test(params.id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const db = supabaseAdmin()
  const { data: existing } = await db.from('payments').select('rental_id').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Marked rather than destroyed: a payment is part of the financial record.
  const { error } = await db.from('payments')
    .update({ deleted_at: new Date().toISOString() }).eq('id', params.id).is('deleted_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (existing.rental_id) await recomputeRentalTotals(db, existing.rental_id)
  return new NextResponse(null, { status: 204 })
}
