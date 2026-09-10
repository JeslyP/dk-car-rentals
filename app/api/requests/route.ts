import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateBookingRequest } from '@/lib/validation'
import { buildBookingConfirmation, buildBookingNotification, emailConfigured, sendEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

/** Public: submit a booking request from the website. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const result = validateBookingRequest(body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const input = result.value
  const db = supabaseAdmin()

  let vehicleLabel: string | null = null
  if (input.requested_vehicle_id) {
    const { data: vehicle } = await db.from('vehicles').select('id, year, make, model').eq('id', input.requested_vehicle_id).maybeSingle()
    if (!vehicle) return NextResponse.json({ error: 'That vehicle is no longer available.' }, { status: 400 })
    vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  }

  const { data, error } = await db.from('rental_requests').insert([{ ...input, status: 'pending' }]).select('id').single()
  if (error) return NextResponse.json({ error: 'Could not submit your request. Please try again.' }, { status: 500 })

  // Notifications are best-effort: a failed email never fails the request.
  if (emailConfigured()) {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin
    const notice = buildBookingNotification(input, vehicleLabel, `${origin}/admin/requests`)
    const jobs: Promise<unknown>[] = [
      sendEmail({ to: process.env.NOTIFY_EMAIL!, replyTo: input.email || undefined, ...notice }),
    ]
    if (input.email) {
      jobs.push(sendEmail({ to: input.email, ...buildBookingConfirmation(input, vehicleLabel) }))
    }
    await Promise.allSettled(jobs)
  }

  return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
}
