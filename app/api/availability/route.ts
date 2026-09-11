import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateDateRange } from '@/lib/validation'
import { bookedVehicleIds } from '@/lib/rentals'

export const dynamic = 'force-dynamic'

/**
 * Public: which vehicles are already booked for a date range.
 * Only vehicle ids leave the server, never renter or payment data.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const range = validateDateRange(url.searchParams.get('start'), url.searchParams.get('end'))
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('rentals')
    .select('vehicle_id, start_date, end_date')
    .lte('start_date', range.value.end)
    .gte('end_date', range.value.start)
  if (error) return NextResponse.json({ error: 'Could not check availability.' }, { status: 500 })

  return NextResponse.json({ booked: Array.from(bookedVehicleIds(data || [], range.value.start, range.value.end)) })
}
