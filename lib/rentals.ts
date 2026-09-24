/**
 * Pure helpers for rental math and dates. No I/O, so they are easy to test.
 * All dates are ISO "YYYY-MM-DD" strings, interpreted as calendar days.
 */

export type DateString = string

export function parseDate(d: DateString): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}

export function toDateString(d: Date): DateString {
  return d.toISOString().slice(0, 10)
}

export function todayString(now = new Date()): DateString {
  return toDateString(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function addDays(d: DateString, days: number): DateString {
  const date = parseDate(d)
  date.setUTCDate(date.getUTCDate() + days)
  return toDateString(date)
}

export function isValidDateString(d: unknown): d is DateString {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const parsed = parseDate(d)
  return !Number.isNaN(parsed.getTime()) && toDateString(parsed) === d
}

/**
 * Number of billable days. A rental returned the same day it was picked up is
 * billed as one day; otherwise it is the number of nights between the dates.
 */
export function rentalDays(start: DateString, end: DateString): number {
  const diff = Math.round((parseDate(end).getTime() - parseDate(start).getTime()) / 86400000)
  return Math.max(1, diff)
}

export function rentalTotal(start: DateString, end: DateString, dailyRate: number): number {
  return round2(rentalDays(start, end) * dailyRate)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * The first day a rental no longer needs the car.
 *
 * The return date is handover day: the car comes back, gets washed, and can
 * go straight out to the next customer, so the rental does not hold it that
 * day. That matches billing, where the 20th to the 21st is one day. A rental
 * that starts and ends on the same day still holds its one day.
 */
export function occupiedUntil(start: DateString, end: DateString): DateString {
  return end > start ? end : addDays(start, 1)
}

/**
 * True when two rentals need the same car on the same day. Handing a car back
 * on the day the next rental starts is not a clash.
 *
 * The database enforces the same rule; see supabase-migration-v9.sql.
 */
export function rangesOverlap(aStart: DateString, aEnd: DateString, bStart: DateString, bEnd: DateString): boolean {
  return aStart < occupiedUntil(bStart, bEnd) && bStart < occupiedUntil(aStart, aEnd)
}

export type RentalLike = { start_date: DateString; end_date: DateString; vehicle_id?: string | null }

/** The two amounts needed to tell whether a rental has been paid off. */
export type RentalMoney = { total_charge: number | string; amount_paid: number | string }

/** Vehicle ids that have a rental overlapping the given range. */
export function bookedVehicleIds(rentals: RentalLike[], start: DateString, end: DateString): Set<string> {
  const ids = new Set<string>()
  for (const r of rentals) {
    if (r.vehicle_id && rangesOverlap(r.start_date, r.end_date, start, end)) ids.add(r.vehicle_id)
  }
  return ids
}

/** A rental is active when today falls within its dates (inclusive). */
export function isActiveRental(r: RentalLike, today = todayString()): boolean {
  return r.start_date <= today && today <= r.end_date
}

export function isUpcomingRental(r: RentalLike, today = todayString()): boolean {
  return r.start_date > today
}

/** True when the return date has already gone by. */
export function isPastRental(r: RentalLike, today = todayString()): boolean {
  return r.end_date < today
}

/** Whole days since the return date. Zero for a rental that is not past yet. */
export function daysPastDue(r: RentalLike, today = todayString()): number {
  if (!isPastRental(r, today)) return 0
  return Math.round((parseDate(today).getTime() - parseDate(r.end_date).getTime()) / 86400000)
}

/**
 * A rental that is over but has not been paid off.
 *
 * Nothing records that a car physically came back, so "overdue" here means the
 * money is overdue: the dates have passed and there is still a balance. These
 * are the rentals that fall through the cracks, because a finished rental is
 * neither active nor upcoming and so appears in neither list.
 */
export function isOverdueRental(r: RentalLike & RentalMoney, today = todayString()): boolean {
  return isPastRental(r, today) && balanceDue(Number(r.total_charge), Number(r.amount_paid)) > 0
}

export type PaymentStatus = 'paid' | 'unpaid' | 'partial'

/** Derive the payment status from the amounts, so the two never disagree. */
export function paymentStatusFor(totalCharge: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return 'unpaid'
  if (amountPaid >= totalCharge) return 'paid'
  return 'partial'
}

export function balanceDue(totalCharge: number, amountPaid: number): number {
  return round2(Math.max(0, totalCharge - amountPaid))
}

export function formatMoney(n: number | string | null | undefined): string {
  const parsed = typeof n === 'string' ? parseFloat(n) : (n ?? 0)
  const num = Number.isFinite(parsed) ? parsed : 0
  // Decide the sign after rounding, so a value that rounds to zero is not
  // shown as "-$0.00". The sign belongs in front of the symbol: -$5.00.
  const cents = Math.round(num * 100)
  return `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`
}

export type VehicleNamed = {
  year: number | string
  make: string
  model: string
  color?: string | null
}

/**
 * How a car is named on the rentals screens.
 *
 * The colour is included whenever it has been recorded, because two cars of
 * the same year, make and model are otherwise impossible to tell apart when
 * picking one out of a list. The money reports use their own label in
 * lib/finance.ts, which stays colourless so the CSV columns do not shift.
 */
export function vehicleName(v: VehicleNamed | null | undefined, fallback = '\u2014'): string {
  if (!v) return fallback
  return `${v.year} ${v.make} ${v.model}`.replace(/\s+/g, ' ').trim()
}

/** The recorded colour, or '' when none was entered. */
export function vehicleColour(v: VehicleNamed | null | undefined): string {
  return typeof v?.color === 'string' ? v.color.trim() : ''
}

/** Name and colour on one line, for a dropdown or a heading. */
export function describeVehicle(v: VehicleNamed | null | undefined, fallback = '\u2014'): string {
  if (!v) return fallback
  const colour = vehicleColour(v)
  return colour ? `${vehicleName(v)} \u00b7 ${colour}` : vehicleName(v)
}

export function formatDate(d: DateString): string {
  if (!isValidDateString(d)) return d
  return parseDate(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}
