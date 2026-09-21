import { describe, expect, it } from 'vitest'
import {
  addDays, balanceDue, bookedVehicleIds, formatDate, formatMoney, isActiveRental, isUpcomingRental,
  isValidDateString, paymentStatusFor, rangesOverlap, rentalDays, rentalTotal,
} from '@/lib/rentals'

describe('rentalDays', () => {
  it('bills a same-day rental as one day', () => {
    expect(rentalDays('2026-03-10', '2026-03-10')).toBe(1)
  })
  it('counts nights between dates', () => {
    expect(rentalDays('2026-03-10', '2026-03-11')).toBe(1)
    expect(rentalDays('2026-03-10', '2026-03-17')).toBe(7)
  })
  it('is not affected by daylight saving transitions', () => {
    expect(rentalDays('2026-03-07', '2026-03-09')).toBe(2)
    expect(rentalDays('2026-11-01', '2026-11-02')).toBe(1)
  })
  it('crosses month and year boundaries', () => {
    expect(rentalDays('2026-12-30', '2027-01-02')).toBe(3)
  })
})

describe('rentalTotal', () => {
  it('multiplies days by rate and rounds to cents', () => {
    expect(rentalTotal('2026-01-01', '2026-01-04', 70)).toBe(210)
    expect(rentalTotal('2026-01-01', '2026-01-04', 33.333)).toBe(100)
  })
})

describe('rangesOverlap / bookedVehicleIds', () => {
  it('detects inclusive overlaps', () => {
    expect(rangesOverlap('2026-01-01', '2026-01-05', '2026-01-05', '2026-01-09')).toBe(true)
    expect(rangesOverlap('2026-01-01', '2026-01-05', '2026-01-06', '2026-01-09')).toBe(false)
    expect(rangesOverlap('2026-01-03', '2026-01-04', '2026-01-01', '2026-01-09')).toBe(true)
  })
  it('collects only overlapping vehicles and ignores unassigned rentals', () => {
    const rentals = [
      { vehicle_id: 'a', start_date: '2026-01-01', end_date: '2026-01-03' },
      { vehicle_id: 'b', start_date: '2026-01-10', end_date: '2026-01-12' },
      { vehicle_id: null, start_date: '2026-01-01', end_date: '2026-01-31' },
    ]
    expect(Array.from(bookedVehicleIds(rentals, '2026-01-03', '2026-01-05'))).toEqual(['a'])
  })
})

describe('active / upcoming', () => {
  const r = { start_date: '2026-05-10', end_date: '2026-05-12' }
  it('is active on start, middle and end day', () => {
    expect(isActiveRental(r, '2026-05-10')).toBe(true)
    expect(isActiveRental(r, '2026-05-11')).toBe(true)
    expect(isActiveRental(r, '2026-05-12')).toBe(true)
    expect(isActiveRental(r, '2026-05-13')).toBe(false)
  })
  it('is upcoming only before it starts', () => {
    expect(isUpcomingRental(r, '2026-05-09')).toBe(true)
    expect(isUpcomingRental(r, '2026-05-10')).toBe(false)
  })
})

describe('payments', () => {
  it('derives status from the amounts', () => {
    expect(paymentStatusFor(100, 0)).toBe('unpaid')
    expect(paymentStatusFor(100, 40)).toBe('partial')
    expect(paymentStatusFor(100, 100)).toBe('paid')
    expect(paymentStatusFor(100, 120)).toBe('paid')
  })
  it('never reports a negative balance', () => {
    expect(balanceDue(100, 30)).toBe(70)
    expect(balanceDue(100, 130)).toBe(0)
  })
})

describe('dates and formatting', () => {
  it('validates date strings strictly', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2026-02-30')).toBe(false)
    expect(isValidDateString('2026-2-3')).toBe(false)
    expect(isValidDateString(null)).toBe(false)
  })
  it('adds days across months', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })
  it('formats money from numbers and numeric strings', () => {
    expect(formatMoney(70)).toBe('$70.00')
    expect(formatMoney('12.5')).toBe('$12.50')
    expect(formatMoney(null)).toBe('$0.00')
  })
  it('formats dates without timezone drift', () => {
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
  })
})

describe('formatMoney with negative amounts', () => {
  it('puts the minus sign in front of the currency symbol', () => {
    expect(formatMoney(-220)).toBe('-$220.00')
    expect(formatMoney('-115.5')).toBe('-$115.50')
    expect(formatMoney(-0.004)).toBe('$0.00')
  })
  it('still formats positives and zero unchanged', () => {
    expect(formatMoney(0)).toBe('$0.00')
    expect(formatMoney(70)).toBe('$70.00')
  })
})
