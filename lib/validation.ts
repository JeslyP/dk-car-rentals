import { isValidDateString } from './rentals'

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

export type BookingRequestInput = {
  name: string
  phone: string
  email: string | null
  requested_vehicle_id: string | null
  start_date: string
  end_date: string
  message: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Validate and normalise a public booking request. */
export function validateBookingRequest(body: unknown): ValidationResult<BookingRequestInput> {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body.' }
  const b = body as Record<string, unknown>

  const name = str(b.name, 120)
  const phone = str(b.phone, 40)
  const email = str(b.email, 200)
  const message = str(b.message, 2000)
  const start_date = str(b.start_date, 10)
  const end_date = str(b.end_date, 10)
  const vehicle = str(b.requested_vehicle_id, 40)

  if (name.length < 2) return { ok: false, error: 'Please enter your full name.' }
  if (phone.replace(/\D/g, '').length < 7) return { ok: false, error: 'Please enter a valid phone number.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Please enter a valid email address.' }
  if (!isValidDateString(start_date) || !isValidDateString(end_date)) return { ok: false, error: 'Please choose valid dates.' }
  if (end_date < start_date) return { ok: false, error: 'The return date must be on or after the pick-up date.' }
  if (vehicle && !UUID_RE.test(vehicle)) return { ok: false, error: 'Invalid vehicle selection.' }

  return {
    ok: true,
    value: {
      name,
      phone,
      email: email || null,
      requested_vehicle_id: vehicle || null,
      start_date,
      end_date,
      message: message || null,
    },
  }
}

export function validateDateRange(start: unknown, end: unknown): ValidationResult<{ start: string; end: string }> {
  if (!isValidDateString(start) || !isValidDateString(end)) return { ok: false, error: 'start and end must be YYYY-MM-DD dates.' }
  if (end < start) return { ok: false, error: 'end must be on or after start.' }
  return { ok: true, value: { start, end } }
}

/**
 * Column allowlists for admin writes. Anything not listed is dropped so a
 * request cannot set columns it should not (id, created_at, ...).
 */
export const WRITABLE_COLUMNS = {
  vehicles: ['vehicle_id', 'make', 'model', 'year', 'color', 'license_plate', 'daily_rate', 'is_available', 'photo_url', 'notes'],
  renters: ['name', 'phone', 'email', 'id_number'],
  rentals: ['vehicle_id', 'renter_id', 'start_date', 'end_date', 'daily_rate', 'total_charge', 'payment_status', 'amount_paid', 'notes'],
  rental_requests: ['status'],
} as const

export type AdminResource = keyof typeof WRITABLE_COLUMNS

export function pickWritable(resource: AdminResource, body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {}
  const allowed: readonly string[] = WRITABLE_COLUMNS[resource]
  const out: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in (body as object)) {
      const v = (body as Record<string, unknown>)[key]
      out[key] = v === '' ? null : v
    }
  }
  return out
}

/** Extra checks that depend on the resource. Returns an error string or null. */
export function validateWrite(resource: AdminResource, data: Record<string, unknown>, isUpdate: boolean): string | null {
  const required = (keys: string[]) => {
    if (isUpdate) return null
    for (const k of keys) {
      if (data[k] === undefined || data[k] === null || data[k] === '') return `${k} is required.`
    }
    return null
  }
  switch (resource) {
    case 'vehicles': {
      const err = required(['vehicle_id', 'make', 'model', 'year', 'license_plate', 'daily_rate'])
      if (err) return err
      if (data.daily_rate !== undefined && (typeof data.daily_rate !== 'number' || data.daily_rate < 0)) return 'daily_rate must be a non-negative number.'
      if (data.year !== undefined && (typeof data.year !== 'number' || data.year < 1900 || data.year > 2100)) return 'year must be a valid year.'
      return null
    }
    case 'renters':
      return required(['name', 'phone'])
    case 'rentals': {
      const err = required(['vehicle_id', 'renter_id', 'start_date', 'end_date', 'daily_rate', 'total_charge'])
      if (err) return err
      if (data.start_date !== undefined && !isValidDateString(data.start_date)) return 'start_date must be YYYY-MM-DD.'
      if (data.end_date !== undefined && !isValidDateString(data.end_date)) return 'end_date must be YYYY-MM-DD.'
      if (data.start_date && data.end_date && (data.end_date as string) < (data.start_date as string)) return 'end_date must be on or after start_date.'
      for (const k of ['daily_rate', 'total_charge', 'amount_paid']) {
        if (data[k] !== undefined && data[k] !== null && (typeof data[k] !== 'number' || (data[k] as number) < 0)) return `${k} must be a non-negative number.`
      }
      if (data.payment_status !== undefined && !['paid', 'unpaid', 'partial'].includes(String(data.payment_status))) return 'payment_status is invalid.'
      return null
    }
    case 'rental_requests':
      if (!['pending', 'approved', 'rejected'].includes(String(data.status))) return 'status is invalid.'
      return null
  }
}
