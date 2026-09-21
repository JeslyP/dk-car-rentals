import type { AdminResource } from './validation'

/**
 * How each admin resource is read from Supabase. Writes are constrained by
 * WRITABLE_COLUMNS in validation.ts.
 */
export const RESOURCES: Record<AdminResource, { select: string; order: { column: string; ascending: boolean } }> = {
  vehicles: { select: '*', order: { column: 'created_at', ascending: true } },
  renters: { select: '*, rentals(count)', order: { column: 'name', ascending: true } },
  rentals: { select: '*, vehicle:vehicles(*), renter:renters(*)', order: { column: 'start_date', ascending: false } },
  rental_requests: { select: '*, vehicle:vehicles(*)', order: { column: 'created_at', ascending: false } },
  expenses: { select: '*, vehicle:vehicles(*)', order: { column: 'spent_on', ascending: false } },
  payments: { select: '*, rental:rentals(id, vehicle_id, renter_id)', order: { column: 'paid_on', ascending: false } },
}

/** URL segment → table name. */
export const RESOURCE_BY_PATH: Record<string, AdminResource> = {
  vehicles: 'vehicles',
  renters: 'renters',
  rentals: 'rentals',
  requests: 'rental_requests',
  expenses: 'expenses',
  payments: 'payments',
}

/**
 * Tables where a delete only marks the row. These hold financial history the
 * business may need years later, so the data always stays. Booking requests
 * are not here: they carry an approved/rejected status instead and the admin
 * never deletes them.
 */
const SOFT_DELETE: ReadonlySet<AdminResource> = new Set<AdminResource>([
  'vehicles', 'renters', 'rentals', 'expenses', 'payments',
])

export function usesSoftDelete(resource: AdminResource): boolean {
  return SOFT_DELETE.has(resource)
}

export function resolveResource(segment: string): AdminResource | null {
  return RESOURCE_BY_PATH[segment] ?? null
}
