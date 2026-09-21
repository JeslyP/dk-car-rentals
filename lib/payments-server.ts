import type { SupabaseClient } from '@supabase/supabase-js'
import { paymentStatusFor, round2 } from './rentals'

/**
 * Recompute a rental's cached amount_paid and payment_status from its payment
 * rows. The database trigger added in migration v3 does this too; doing it
 * here as well keeps the figures correct on a database where the trigger has
 * not been installed yet, and is a harmless no-op where it has.
 */
export async function recomputeRentalTotals(db: SupabaseClient, rentalId: string): Promise<void> {
  const [{ data: payments }, { data: rental }] = await Promise.all([
    db.from('payments').select('amount').eq('rental_id', rentalId).is('deleted_at', null),
    db.from('rentals').select('total_charge').eq('id', rentalId).maybeSingle(),
  ])
  if (!rental) return
  const paid = round2((payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0))
  await db.from('rentals')
    .update({ amount_paid: paid, payment_status: paymentStatusFor(Number(rental.total_charge), paid) })
    .eq('id', rentalId)
}
