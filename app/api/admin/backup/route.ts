import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Every table worth keeping, in an order that can be restored top to bottom. */
const TABLES = ['vehicles', 'renters', 'rentals', 'payments', 'expenses', 'rental_requests'] as const

/**
 * A complete copy of the business records as one JSON file.
 *
 * The free Supabase plan keeps no restorable backups, and these are the
 * numbers the business files tax on, so there needs to be a copy somewhere
 * else. Raw rows rather than the joined shapes the admin pages use, so the
 * file can be loaded straight back into the same tables.
 */
export async function GET(req: Request) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = supabaseAdmin()
  const data: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}

  for (const table of TABLES) {
    const { data: rows, error } = await db.from(table).select('*')
    if (error) {
      return NextResponse.json({ error: `Could not read ${table}: ${error.message}` }, { status: 500 })
    }
    data[table] = rows ?? []
    counts[table] = rows?.length ?? 0
  }

  const exportedAt = new Date().toISOString()
  const body = JSON.stringify({
    app: 'dk-car-rentals',
    format: 1,
    exported_at: exportedAt,
    counts,
    data,
  }, null, 2)

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dj-backup-${exportedAt.slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
