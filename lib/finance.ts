/**
 * Bookkeeping maths. Pure functions over plain rows so they can be unit
 * tested without a database.
 *
 * Two ways of counting income, both reported because they answer different
 * questions:
 *
 *  - collected (cash basis)  — money actually received in the period, dated by
 *                              the payment. This is normally what tax is owed
 *                              on and what the headline figures use.
 *  - charged  (accrual)      — the value of rentals that started in the period,
 *                              whether or not the customer has paid yet.
 */

import { round2, parseDate, toDateString } from './rentals'

export type MonthKey = string // 'YYYY-MM'

export const EXPENSE_CATEGORIES = [
  'fuel', 'maintenance', 'repair', 'tires', 'parts', 'insurance',
  'registration', 'cleaning', 'towing', 'loan', 'fees', 'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance / service',
  repair: 'Repairs',
  tires: 'Tires',
  parts: 'Parts',
  insurance: 'Insurance',
  registration: 'Registration / licensing',
  cleaning: 'Cleaning',
  towing: 'Towing',
  loan: 'Loan / financing',
  fees: 'Fees',
  other: 'Other',
}

export const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'cheque', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export type RentalRow = {
  id: string
  vehicle_id: string | null
  start_date: string
  end_date: string
  total_charge: number | string
  amount_paid: number | string
}
export type PaymentRow = {
  id: string
  rental_id: string | null
  paid_on: string
  amount: number | string
}
export type ExpenseRow = {
  id: string
  vehicle_id: string | null
  spent_on: string
  category: string
  amount: number | string
}
export type VehicleRef = { id: string; year: number; make: string; model: string }

const n = (v: number | string | null | undefined): number => {
  const num = typeof v === 'string' ? parseFloat(v) : (v ?? 0)
  return Number.isFinite(num) ? num : 0
}

const inRange = (date: string, from: string, to: string) => date >= from && date <= to

// ---------------------------------------------------------------- months

/** 'YYYY-MM' for an ISO date string. */
export function monthKey(date: string): MonthKey {
  return date.slice(0, 7)
}

/** First day of a month key. */
export function monthStart(key: MonthKey): string {
  return `${key}-01`
}

/** Last day of a month key, leap years included. */
export function monthEnd(key: MonthKey): string {
  const [y, m] = key.split('-').map(Number)
  return toDateString(new Date(Date.UTC(y, m, 0)))
}

/** 'March 2026' for a month key. */
export function monthLabel(key: MonthKey): string {
  return parseDate(monthStart(key)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** 'Mar 26' for a month key, for tight table headers. */
export function shortMonthLabel(key: MonthKey): string {
  return parseDate(monthStart(key)).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

export function currentMonthKey(now = new Date()): MonthKey {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Shift a month key by whole months. */
export function shiftMonthKey(key: MonthKey, delta: number): MonthKey {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Every month key from `from` to `to` inclusive. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  if (from > to) return []
  const out: MonthKey[] = []
  let cur = from
  // Guard against a pathological range producing an unbounded list.
  for (let i = 0; cur <= to && i < 600; i++) {
    out.push(cur)
    cur = shiftMonthKey(cur, 1)
  }
  return out
}

/** The date range covered by a report period. */
export function periodRange(period: { kind: 'month'; month: MonthKey } | { kind: 'year'; year: number } | { kind: 'custom'; from: string; to: string }): { from: string; to: string } {
  if (period.kind === 'month') return { from: monthStart(period.month), to: monthEnd(period.month) }
  if (period.kind === 'year') return { from: `${period.year}-01-01`, to: `${period.year}-12-31` }
  return { from: period.from, to: period.to }
}

// ---------------------------------------------------------------- totals

export type VehicleBreakdown = {
  vehicleId: string | null
  label: string
  collected: number
  charged: number
  outstanding: number
  expenses: number
  net: number
  rentals: number
}

export type MonthBreakdown = {
  month: MonthKey
  collected: number
  charged: number
  expenses: number
  net: number
}

export type Summary = {
  from: string
  to: string
  collected: number
  charged: number
  /** Charged but not yet received, on rentals that started in the period. */
  outstanding: number
  expenses: number
  /** collected − expenses. The cash-basis profit. */
  net: number
  /** Profit as a share of money collected, 0 when nothing came in. */
  margin: number
  rentalCount: number
  paymentCount: number
  expenseCount: number
  byCategory: { category: string; label: string; amount: number; share: number }[]
  byVehicle: VehicleBreakdown[]
  byMonth: MonthBreakdown[]
}

export function vehicleLabel(v: VehicleRef | undefined | null): string {
  return v ? `${v.year} ${v.make} ${v.model}` : 'Not assigned to a vehicle'
}

export type SummaryInput = {
  rentals: RentalRow[]
  payments: PaymentRow[]
  expenses: ExpenseRow[]
  vehicles: VehicleRef[]
}

/**
 * Aggregate everything a monthly or yearly statement needs.
 *
 * Payments are attributed to the vehicle of the rental they belong to, so a
 * payment received in October for a September rental counts as October income
 * on that same car.
 */
export function summarise(input: SummaryInput, from: string, to: string): Summary {
  const { rentals, payments, expenses, vehicles } = input

  const vehicleById = new Map(vehicles.map(v => [v.id, v]))
  const rentalById = new Map(rentals.map(r => [r.id, r]))

  const periodPayments = payments.filter(p => inRange(p.paid_on, from, to))
  const periodExpenses = expenses.filter(e => inRange(e.spent_on, from, to))
  const periodRentals = rentals.filter(r => inRange(r.start_date, from, to))

  const collected = round2(periodPayments.reduce((s, p) => s + n(p.amount), 0))
  const charged = round2(periodRentals.reduce((s, r) => s + n(r.total_charge), 0))
  const outstanding = round2(periodRentals.reduce((s, r) => s + Math.max(0, n(r.total_charge) - n(r.amount_paid)), 0))
  const spent = round2(periodExpenses.reduce((s, e) => s + n(e.amount), 0))
  const net = round2(collected - spent)

  // --- by category
  const catTotals = new Map<string, number>()
  for (const e of periodExpenses) {
    catTotals.set(e.category, round2((catTotals.get(e.category) || 0) + n(e.amount)))
  }
  const byCategory = Array.from(catTotals, ([category, amount]) => ({
    category,
    label: CATEGORY_LABELS[category as ExpenseCategory] || category,
    amount,
    share: spent > 0 ? amount / spent : 0,
  })).sort((a, b) => b.amount - a.amount)

  // --- by vehicle
  const rows = new Map<string, VehicleBreakdown>()
  const rowFor = (vehicleId: string | null): VehicleBreakdown => {
    const key = vehicleId ?? '__none__'
    let row = rows.get(key)
    if (!row) {
      row = {
        vehicleId,
        label: vehicleId ? vehicleLabel(vehicleById.get(vehicleId)) : 'Not assigned to a vehicle',
        collected: 0, charged: 0, outstanding: 0, expenses: 0, net: 0, rentals: 0,
      }
      rows.set(key, row)
    }
    return row
  }

  // Every vehicle appears, even an idle one, so a car that cost money and
  // earned nothing is visible rather than missing.
  for (const v of vehicles) rowFor(v.id)

  for (const p of periodPayments) {
    const rental = p.rental_id ? rentalById.get(p.rental_id) : undefined
    rowFor(rental?.vehicle_id ?? null).collected += n(p.amount)
  }
  for (const r of periodRentals) {
    const row = rowFor(r.vehicle_id)
    row.charged += n(r.total_charge)
    row.outstanding += Math.max(0, n(r.total_charge) - n(r.amount_paid))
    row.rentals += 1
  }
  for (const e of periodExpenses) {
    rowFor(e.vehicle_id).expenses += n(e.amount)
  }

  const byVehicle = Array.from(rows.values()).map(r => ({
    ...r,
    collected: round2(r.collected),
    charged: round2(r.charged),
    outstanding: round2(r.outstanding),
    expenses: round2(r.expenses),
    net: round2(r.collected - r.expenses),
  })).sort((a, b) => b.net - a.net || b.collected - a.collected)

  // --- by month
  const months = monthsBetween(monthKey(from), monthKey(to))
  const byMonth: MonthBreakdown[] = months.map(month => {
    const mFrom = monthStart(month) < from ? from : monthStart(month)
    const mTo = monthEnd(month) > to ? to : monthEnd(month)
    const c = round2(payments.filter(p => inRange(p.paid_on, mFrom, mTo)).reduce((s, p) => s + n(p.amount), 0))
    const ch = round2(rentals.filter(r => inRange(r.start_date, mFrom, mTo)).reduce((s, r) => s + n(r.total_charge), 0))
    const ex = round2(expenses.filter(e => inRange(e.spent_on, mFrom, mTo)).reduce((s, e) => s + n(e.amount), 0))
    return { month, collected: c, charged: ch, expenses: ex, net: round2(c - ex) }
  })

  return {
    from,
    to,
    collected,
    charged,
    outstanding,
    expenses: spent,
    net,
    margin: collected > 0 ? net / collected : 0,
    rentalCount: periodRentals.length,
    paymentCount: periodPayments.length,
    expenseCount: periodExpenses.length,
    byCategory,
    byVehicle,
    byMonth,
  }
}

// ---------------------------------------------------------------- csv

/** A plain number, including a negative or decimal one. */
const NUMERIC_RE = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i

/**
 * Quote a CSV field. Text starting with =, +, -, @ or a control character is
 * prefixed with an apostrophe so a spreadsheet does not run it as a formula.
 * Real numbers are left alone, so a negative figure such as a monthly loss
 * still imports as a number rather than as text.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (/^[=+\-@\t\r]/.test(s) && !NUMERIC_RE.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n')
}

/** The rows of a monthly statement, ready to hand to an accountant. */
export function statementCsv(summary: Summary, periodTitle: string): string {
  const rows: (string | number | null)[][] = [
    ['D&K Car Rentals — financial statement'],
    ['Period', periodTitle],
    ['Dates', `${summary.from} to ${summary.to}`],
    [],
    ['Summary'],
    ['Money collected', summary.collected.toFixed(2)],
    ['Expenses', summary.expenses.toFixed(2)],
    ['Net profit', summary.net.toFixed(2)],
    ['Invoiced in period', summary.charged.toFixed(2)],
    ['Still owed on those rentals', summary.outstanding.toFixed(2)],
    [],
    ['Per vehicle'],
    ['Vehicle', 'Rentals', 'Collected', 'Expenses', 'Net', 'Invoiced', 'Still owed'],
    ...summary.byVehicle.map(v => [v.label, v.rentals, v.collected.toFixed(2), v.expenses.toFixed(2), v.net.toFixed(2), v.charged.toFixed(2), v.outstanding.toFixed(2)]),
    [],
    ['Expenses by category'],
    ['Category', 'Amount'],
    ...summary.byCategory.map(c => [c.label, c.amount.toFixed(2)]),
    [],
    ['Month by month'],
    ['Month', 'Collected', 'Expenses', 'Net'],
    ...summary.byMonth.map(m => [monthLabel(m.month), m.collected.toFixed(2), m.expenses.toFixed(2), m.net.toFixed(2)]),
  ]
  return toCsv(rows)
}

/** One row per expense, for the accountant's records. */
export function expensesCsv(expenses: (ExpenseRow & { vehicle?: VehicleRef | null; vendor?: string | null; description?: string | null })[]): string {
  return toCsv([
    ['Date', 'Vehicle', 'Category', 'Amount', 'Vendor', 'Description'],
    ...expenses.map(e => [
      e.spent_on,
      e.vehicle ? vehicleLabel(e.vehicle) : '',
      CATEGORY_LABELS[e.category as ExpenseCategory] || e.category,
      n(e.amount).toFixed(2),
      e.vendor || '',
      e.description || '',
    ]),
  ])
}
