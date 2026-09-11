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
}

/** URL segment → table name. */
export const RESOURCE_BY_PATH: Record<string, AdminResource> = {
  vehicles: 'vehicles',
  renters: 'renters',
  rentals: 'rentals',
  requests: 'rental_requests',
}

export function resolveResource(segment: string): AdminResource | null {
  return RESOURCE_BY_PATH[segment] ?? null
}
