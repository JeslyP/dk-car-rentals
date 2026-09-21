/**
 * What each customer has been charged, what they have paid, and what is
 * still owed.
 *
 * The money follows the same rules as everywhere else in the app: a rental's
 * charge is what was agreed, and what has been paid is derived from the
 * payments recorded against it — never typed in directly. Nothing here reads
 * the database, so it is all testable.
 */
import {
  DateString, RentalLike, RentalMoney, balanceDue, isOverdueRental, round2, todayString,
} from './rentals'

export type RenterLike = { id: string; name: string }

export type AccountRental = RentalLike & RentalMoney & { id: string; renter_id?: string | null }

export type RenterAccount = {
  /** Null for the row holding rentals that were never assigned to a customer. */
  renterId: string | null
  name: string
  rentals: number
  charged: number
  paid: number
  owed: number
  /** The part of `owed` that sits on rentals whose return date has passed. */
  overdue: number
  /** The most recent end date across their rentals, or null if they have none. */
  lastRental: DateString | null
}

export type AccountTotals = {
  charged: number
  paid: number
  owed: number
  overdue: number
  /** How many customers owe something, ignoring the unassigned row. */
  owing: number
}

/** The label used for rentals that were logged without a customer. */
export const UNASSIGNED_LABEL = 'No renter recorded'

/**
 * One row per customer, plus — only when such rentals exist — a final row
 * gathering rentals with no customer against them. That row is what makes the
 * table add up to the business totals on the dashboard instead of quietly
 * falling short of them.
 *
 * Customers who owe money come first, largest debt at the top, so the people
 * to chase are the ones you see. Everyone else follows by name.
 */
export function renterAccounts(
  renters: RenterLike[],
  rentals: AccountRental[],
  today: DateString = todayString(),
): RenterAccount[] {
  const blank = (renterId: string | null, name: string): RenterAccount => ({
    renterId, name, rentals: 0, charged: 0, paid: 0, owed: 0, overdue: 0, lastRental: null,
  })

  const byId = new Map<string, RenterAccount>()
  for (const r of renters) byId.set(r.id, blank(r.id, r.name))

  let unassigned: RenterAccount | null = null

  for (const rental of rentals) {
    // A rental whose customer has been removed still counts as unassigned
    // money rather than vanishing from the totals.
    const known = rental.renter_id ? byId.get(rental.renter_id) : undefined
    let account = known
    if (!account) {
      unassigned = unassigned ?? blank(null, UNASSIGNED_LABEL)
      account = unassigned
    }

    const charge = Number(rental.total_charge) || 0
    const paid = Number(rental.amount_paid) || 0
    const due = balanceDue(charge, paid)

    account.rentals += 1
    account.charged += charge
    account.paid += paid
    account.owed += due
    if (isOverdueRental(rental, today)) account.overdue += due
    if (!account.lastRental || rental.end_date > account.lastRental) account.lastRental = rental.end_date
  }

  const rounded = (a: RenterAccount): RenterAccount => ({
    ...a,
    charged: round2(a.charged),
    paid: round2(a.paid),
    owed: round2(a.owed),
    overdue: round2(a.overdue),
  })

  const people = Array.from(byId.values()).map(rounded).sort((a, b) => {
    if (a.owed !== b.owed) return b.owed - a.owed
    return a.name.localeCompare(b.name)
  })

  return unassigned ? [...people, rounded(unassigned)] : people
}

/** The business-wide position. Includes the unassigned row, so it reconciles. */
export function accountTotals(accounts: RenterAccount[]): AccountTotals {
  const t = accounts.reduce(
    (acc, a) => ({
      charged: acc.charged + a.charged,
      paid: acc.paid + a.paid,
      owed: acc.owed + a.owed,
      overdue: acc.overdue + a.overdue,
      owing: acc.owing + (a.renterId !== null && a.owed > 0 ? 1 : 0),
    }),
    { charged: 0, paid: 0, owed: 0, overdue: 0, owing: 0 },
  )
  return { ...t, charged: round2(t.charged), paid: round2(t.paid), owed: round2(t.owed), overdue: round2(t.overdue) }
}

/** The share of everything charged that has actually come in, 0 when nothing has. */
export function collectedShare(totals: AccountTotals): number {
  return totals.charged > 0 ? totals.paid / totals.charged : 0
}
