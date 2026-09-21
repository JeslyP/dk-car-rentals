import { describe, expect, it } from 'vitest'
import {
  UNASSIGNED_LABEL, accountTotals, collectedShare, renterAccounts,
} from '@/lib/renter-accounts'

const renters = [
  { id: 'a', name: 'Marcus Allen' },
  { id: 'b', name: 'Dana Whitfield' },
  { id: 'c', name: 'Ibrahim Osei' },
]

// 'b' owes the most, 'a' owes a little, 'c' is square. One rental has no renter.
const rentals = [
  { id: 'r1', renter_id: 'a', start_date: '2026-05-01', end_date: '2026-05-05', total_charge: 200, amount_paid: 150 },
  { id: 'r2', renter_id: 'b', start_date: '2026-05-02', end_date: '2026-05-09', total_charge: 500, amount_paid: 0 },
  { id: 'r3', renter_id: 'b', start_date: '2026-06-01', end_date: '2026-06-03', total_charge: 120, amount_paid: 120 },
  { id: 'r4', renter_id: 'c', start_date: '2026-05-10', end_date: '2026-05-12', total_charge: 300, amount_paid: 300 },
  { id: 'r5', renter_id: null, start_date: '2026-05-20', end_date: '2026-05-22', total_charge: 80, amount_paid: 30 },
]

const today = '2026-06-30'

describe('renterAccounts', () => {
  it('totals each customer separately', () => {
    const accounts = renterAccounts(renters, rentals, today)
    const b = accounts.find(a => a.renterId === 'b')!
    expect(b.rentals).toBe(2)
    expect(b.charged).toBe(620)
    expect(b.paid).toBe(120)
    expect(b.owed).toBe(500)
  })

  it('puts the biggest debtor first and the settled customers after', () => {
    const accounts = renterAccounts(renters, rentals, today)
    expect(accounts.map(a => a.name)).toEqual([
      'Dana Whitfield',   // owes 500
      'Marcus Allen',     // owes 50
      'Ibrahim Osei',     // square
      UNASSIGNED_LABEL,   // always last
    ])
  })

  it('keeps a customer with no rentals, showing zeros', () => {
    const accounts = renterAccounts([{ id: 'z', name: 'Priya Raman' }], [], today)
    expect(accounts).toHaveLength(1)
    expect(accounts[0]).toMatchObject({ rentals: 0, charged: 0, paid: 0, owed: 0, lastRental: null })
  })

  it('gathers rentals with no renter into one row', () => {
    const accounts = renterAccounts(renters, rentals, today)
    const none = accounts.find(a => a.renterId === null)!
    expect(none.name).toBe(UNASSIGNED_LABEL)
    expect(none.charged).toBe(80)
    expect(none.owed).toBe(50)
  })

  it('treats a rental pointing at a deleted renter as unassigned rather than dropping it', () => {
    const accounts = renterAccounts(renters, [
      { id: 'r9', renter_id: 'gone', start_date: '2026-05-01', end_date: '2026-05-02', total_charge: 90, amount_paid: 0 },
    ], today)
    const none = accounts.find(a => a.renterId === null)!
    expect(none.charged).toBe(90)
    expect(none.owed).toBe(90)
  })

  it('omits the unassigned row when every rental has a renter', () => {
    const accounts = renterAccounts(renters, rentals.filter(r => r.renter_id), today)
    expect(accounts.some(a => a.renterId === null)).toBe(false)
  })

  it('counts only past-due balances as overdue', () => {
    // r2 ended 2026-05-09 owing 500; r6 runs past today owing 70.
    const accounts = renterAccounts(renters, [
      ...rentals,
      { id: 'r6', renter_id: 'b', start_date: '2026-06-28', end_date: '2026-07-04', total_charge: 70, amount_paid: 0 },
    ], today)
    const b = accounts.find(a => a.renterId === 'b')!
    expect(b.owed).toBe(570)
    expect(b.overdue).toBe(500)
  })

  it('never reports a negative balance when a customer overpaid', () => {
    const accounts = renterAccounts([{ id: 'a', name: 'Marcus Allen' }], [
      { id: 'r1', renter_id: 'a', start_date: '2026-05-01', end_date: '2026-05-02', total_charge: 100, amount_paid: 130 },
    ], today)
    expect(accounts[0].owed).toBe(0)
    expect(accounts[0].paid).toBe(130)
  })

  it('reads amounts that arrive from the database as strings', () => {
    const accounts = renterAccounts([{ id: 'a', name: 'Marcus Allen' }], [
      { id: 'r1', renter_id: 'a', start_date: '2026-05-01', end_date: '2026-05-02', total_charge: '200.50', amount_paid: '100.25' },
    ], today)
    expect(accounts[0].charged).toBe(200.5)
    expect(accounts[0].paid).toBe(100.25)
    expect(accounts[0].owed).toBe(100.25)
  })

  it('tracks the latest end date as the last rental', () => {
    const accounts = renterAccounts(renters, rentals, today)
    expect(accounts.find(a => a.renterId === 'b')!.lastRental).toBe('2026-06-03')
  })

  it('does not accumulate rounding error across many small rentals', () => {
    const many = Array.from({ length: 3 }, (_, i) => ({
      id: `x${i}`, renter_id: 'a', start_date: '2026-05-01', end_date: '2026-05-02',
      total_charge: 0.1, amount_paid: 0,
    }))
    const accounts = renterAccounts([{ id: 'a', name: 'Marcus Allen' }], many, today)
    expect(accounts[0].charged).toBe(0.3)
  })
})

describe('accountTotals', () => {
  it('adds up to the whole business, unassigned money included', () => {
    const totals = accountTotals(renterAccounts(renters, rentals, today))
    expect(totals.charged).toBe(1200) // 200 + 500 + 120 + 300 + 80
    expect(totals.paid).toBe(600)     // 150 +   0 + 120 + 300 + 30
    expect(totals.owed).toBe(600)     //  50 + 500 +   0 +   0 + 50
  })

  it('reconciles: charged minus paid equals owed when nobody overpaid', () => {
    const totals = accountTotals(renterAccounts(renters, rentals, today))
    expect(totals.charged - totals.paid).toBe(totals.owed)
  })

  it('counts customers who owe, not the unassigned row', () => {
    const totals = accountTotals(renterAccounts(renters, rentals, today))
    expect(totals.owing).toBe(2) // Dana and Marcus; the unassigned 50 is excluded
  })

  it('is all zeroes with no data', () => {
    expect(accountTotals([])).toEqual({ charged: 0, paid: 0, owed: 0, overdue: 0, owing: 0 })
  })
})

describe('collectedShare', () => {
  it('is the paid share of everything charged', () => {
    expect(collectedShare({ charged: 1000, paid: 750, owed: 250, overdue: 0, owing: 1 })).toBe(0.75)
  })
  it('is zero rather than NaN when nothing has been charged', () => {
    expect(collectedShare({ charged: 0, paid: 0, owed: 0, overdue: 0, owing: 0 })).toBe(0)
  })
})
