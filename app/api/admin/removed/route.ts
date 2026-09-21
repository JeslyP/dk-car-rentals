import { NextResponse } from 'next/server'
import { isAuthenticatedRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export type RemovedItem = {
  resource: 'vehicles' | 'renters' | 'rentals' | 'payments' | 'expenses'
  path: string          // the URL segment the API uses
  id: string
  label: string         // what it was, in plain words
  detail: string        // enough to recognise it
  deleted_at: string
  /** What else goes if this is destroyed for good. */
  consequence: string | null
}

const money = (n: unknown) => `$${Number(n ?? 0).toFixed(2)}`

/** Everything currently hidden by a delete, newest removal first. */
export async function GET(req: Request) {
  if (!(await isAuthenticatedRequest(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = supabaseAdmin()

  const [vehicles, renters, rentals, payments, expenses] = await Promise.all([
    db.from('vehicles').select('id, year, make, model, vehicle_id, license_plate, deleted_at').not('deleted_at', 'is', null),
    db.from('renters').select('id, name, phone, deleted_at').not('deleted_at', 'is', null),
    db.from('rentals').select('id, start_date, end_date, total_charge, deleted_at, vehicle:vehicles(year, make, model), renter:renters(name)').not('deleted_at', 'is', null),
    db.from('payments').select('id, paid_on, amount, method, deleted_at').not('deleted_at', 'is', null),
    db.from('expenses').select('id, spent_on, category, amount, vendor, deleted_at, vehicle:vehicles(year, make, model)').not('deleted_at', 'is', null),
  ])

  const firstError = [vehicles, renters, rentals, payments, expenses].find(r => r.error)
  if (firstError?.error) return NextResponse.json({ error: firstError.error.message }, { status: 500 })

  const car = (v: { year?: number; make?: string; model?: string } | null | undefined) =>
    v ? `${v.year} ${v.make} ${v.model}` : null

  const items: RemovedItem[] = [
    ...(vehicles.data ?? []).map(v => ({
      resource: 'vehicles' as const, path: 'vehicles', id: v.id,
      label: `${v.year} ${v.make} ${v.model}`,
      detail: `#${v.vehicle_id} · plate ${v.license_plate}`,
      deleted_at: v.deleted_at as string,
      consequence: 'Its past rentals and costs stay, but they lose the link to this vehicle and show as unassigned in reports.',
    })),
    ...(renters.data ?? []).map(r => ({
      resource: 'renters' as const, path: 'renters', id: r.id,
      label: r.name as string,
      detail: (r.phone as string) || 'no phone recorded',
      deleted_at: r.deleted_at as string,
      consequence: 'Their past rentals stay, but they lose the customer name.',
    })),
    ...(rentals.data ?? []).map(r => ({
      resource: 'rentals' as const, path: 'rentals', id: r.id,
      label: `Rental · ${(r.renter as { name?: string } | null)?.name ?? 'unknown customer'}`,
      detail: `${car(r.vehicle as never) ?? 'vehicle removed'} · ${r.start_date} to ${r.end_date} · ${money(r.total_charge)}`,
      deleted_at: r.deleted_at as string,
      consequence: 'Every payment recorded against this rental is destroyed with it.',
    })),
    ...(payments.data ?? []).map(p => ({
      resource: 'payments' as const, path: 'payments', id: p.id,
      label: `Payment ${money(p.amount)}`,
      detail: `received ${p.paid_on} · ${p.method ?? 'other'}`,
      deleted_at: p.deleted_at as string,
      consequence: null,
    })),
    ...(expenses.data ?? []).map(e => ({
      resource: 'expenses' as const, path: 'expenses', id: e.id,
      label: `Cost ${money(e.amount)} · ${e.category}`,
      detail: `${e.spent_on}${e.vendor ? ` · ${e.vendor}` : ''}${car(e.vehicle as never) ? ` · ${car(e.vehicle as never)}` : ''}`,
      deleted_at: e.deleted_at as string,
      consequence: null,
    })),
  ].sort((a, b) => (b.deleted_at || '').localeCompare(a.deleted_at || ''))

  return NextResponse.json(items)
}
