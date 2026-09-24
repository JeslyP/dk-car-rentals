import { describe, expect, it } from 'vitest'
import {
  addDays, balanceDue, bookedVehicleIds, daysPastDue, describeVehicle, formatDate, formatMoney, isActiveRental,
  isOverdueRental, isPastRental, isUpcomingRental,
  isValidDateString, paymentStatusFor, rangesOverlap, rentalDays, rentalTotal,
  vehicleColour, vehicleName,
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
  it('lets a car go back out on the day it is returned', () => {
    // Returned on the 21st, washed, rented again on the 21st.
    expect(rangesOverlap('2026-09-20', '2026-09-21', '2026-09-21', '2026-09-23')).toBe(false)
    expect(rangesOverlap('2026-09-21', '2026-09-23', '2026-09-20', '2026-09-21')).toBe(false)
  })
  it('still catches two rentals that share a night', () => {
    expect(rangesOverlap('2026-09-20', '2026-09-22', '2026-09-21', '2026-09-23')).toBe(true)
    expect(rangesOverlap('2026-01-03', '2026-01-04', '2026-01-01', '2026-01-09')).toBe(true)
    expect(rangesOverlap('2026-01-01', '2026-01-09', '2026-01-01', '2026-01-09')).toBe(true)
  })
  it('treats a same-day rental as holding its one day', () => {
    expect(rangesOverlap('2026-09-21', '2026-09-21', '2026-09-21', '2026-09-23')).toBe(true)
    expect(rangesOverlap('2026-09-21', '2026-09-21', '2026-09-21', '2026-09-21')).toBe(true)
    // ...but it can follow a rental returned that morning.
    expect(rangesOverlap('2026-09-20', '2026-09-21', '2026-09-21', '2026-09-21')).toBe(false)
  })
  it('leaves separate weeks alone', () => {
    expect(rangesOverlap('2026-01-01', '2026-01-05', '2026-01-06', '2026-01-09')).toBe(false)
  })
  it('collects only overlapping vehicles and ignores unassigned rentals', () => {
    const rentals = [
      { vehicle_id: 'a', start_date: '2026-01-01', end_date: '2026-01-03' },
      { vehicle_id: 'b', start_date: '2026-01-10', end_date: '2026-01-12' },
      { vehicle_id: null, start_date: '2026-01-01', end_date: '2026-01-31' },
    ]
    // 'a' is out 1st-3rd, so a booking from the 2nd clashes...
    expect(Array.from(bookedVehicleIds(rentals, '2026-01-02', '2026-01-05'))).toEqual(['a'])
    // ...but one from the 3rd, its return day, does not.
    expect(Array.from(bookedVehicleIds(rentals, '2026-01-03', '2026-01-05'))).toEqual([])
  })
  it('offers a car for a booking that starts on its return day', () => {
    const rentals = [{ vehicle_id: 'vitz', start_date: '2026-09-20', end_date: '2026-09-21' }]
    expect(bookedVehicleIds(rentals, '2026-09-21', '2026-09-23').size).toBe(0)
    expect(bookedVehicleIds(rentals, '2026-09-20', '2026-09-23').has('vitz')).toBe(true)
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
  it('leaves a finished rental out of both buckets', () => {
    expect(isActiveRental(r, '2026-05-13')).toBe(false)
    expect(isUpcomingRental(r, '2026-05-13')).toBe(false)
    expect(isPastRental(r, '2026-05-13')).toBe(true)
  })
  it('is not past on the last day of the rental', () => {
    expect(isPastRental(r, '2026-05-12')).toBe(false)
    expect(isPastRental(r, '2026-05-13')).toBe(true)
  })
})

describe('overdue', () => {
  const dates = { start_date: '2026-05-10', end_date: '2026-05-12' }
  const unpaid = { ...dates, total_charge: 210, amount_paid: 0 }
  const part = { ...dates, total_charge: 210, amount_paid: 50 }
  const settled = { ...dates, total_charge: 210, amount_paid: 210 }

  it('flags a finished rental that still owes money', () => {
    expect(isOverdueRental(unpaid, '2026-05-13')).toBe(true)
    expect(isOverdueRental(part, '2026-05-13')).toBe(true)
  })
  it('does not flag one that is paid off', () => {
    expect(isOverdueRental(settled, '2026-05-13')).toBe(false)
  })
  it('does not flag a rental that has not ended yet', () => {
    expect(isOverdueRental(unpaid, '2026-05-11')).toBe(false)
    expect(isOverdueRental(unpaid, '2026-05-12')).toBe(false)
  })
  it('treats an overpayment as settled', () => {
    expect(isOverdueRental({ ...dates, total_charge: 210, amount_paid: 250 }, '2026-05-13')).toBe(false)
  })
  it('reads amounts that arrive from the database as strings', () => {
    expect(isOverdueRental({ ...dates, total_charge: '210.00', amount_paid: '0.00' }, '2026-05-13')).toBe(true)
    expect(isOverdueRental({ ...dates, total_charge: '210.00', amount_paid: '210.00' }, '2026-05-13')).toBe(false)
  })

  it('counts whole days since the return date', () => {
    expect(daysPastDue(dates, '2026-05-12')).toBe(0)
    expect(daysPastDue(dates, '2026-05-13')).toBe(1)
    expect(daysPastDue(dates, '2026-05-22')).toBe(10)
  })
  it('counts days across a month boundary and a DST change', () => {
    expect(daysPastDue({ start_date: '2026-02-25', end_date: '2026-02-28' }, '2026-03-02')).toBe(2)
    expect(daysPastDue({ start_date: '2026-03-06', end_date: '2026-03-07' }, '2026-03-09')).toBe(2)
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

describe('describeVehicle', () => {
  const fit = { year: 2015, make: 'Honda', model: 'Fit' }

  it('adds the colour when one is recorded', () => {
    expect(describeVehicle({ ...fit, color: 'Black' })).toBe('2015 Honda Fit \u00b7 Black')
  })
  it('leaves the name alone when no colour is recorded', () => {
    expect(describeVehicle(fit)).toBe('2015 Honda Fit')
    expect(describeVehicle({ ...fit, color: null })).toBe('2015 Honda Fit')
    expect(describeVehicle({ ...fit, color: '' })).toBe('2015 Honda Fit')
    expect(describeVehicle({ ...fit, color: '   ' })).toBe('2015 Honda Fit')
  })
  it('trims a colour typed with stray spaces', () => {
    expect(describeVehicle({ ...fit, color: '  Silver ' })).toBe('2015 Honda Fit \u00b7 Silver')
  })
  it('tells two identical cars apart', () => {
    const a = describeVehicle({ ...fit, color: 'Black' })
    const b = describeVehicle({ ...fit, color: 'Red' })
    expect(a).not.toBe(b)
  })
  it('falls back when the vehicle is missing, and the caller can word it', () => {
    expect(describeVehicle(null)).toBe('\u2014')
    expect(describeVehicle(undefined)).toBe('\u2014')
    expect(describeVehicle(null, 'vehicle removed')).toBe('vehicle removed')
  })
})

describe('vehicleName / vehicleColour', () => {
  const fit = { year: 2015, make: 'Honda', model: 'Fit', color: 'Black' }

  it('gives the name without the colour, for the two-line table cell', () => {
    expect(vehicleName(fit)).toBe('2015 Honda Fit')
  })
  it('gives the colour on its own, trimmed', () => {
    expect(vehicleColour(fit)).toBe('Black')
    expect(vehicleColour({ ...fit, color: '  Silver ' })).toBe('Silver')
  })
  it('gives an empty colour rather than undefined when none is recorded', () => {
    expect(vehicleColour({ year: 2015, make: 'Honda', model: 'Fit' })).toBe('')
    expect(vehicleColour({ ...fit, color: null })).toBe('')
    expect(vehicleColour(null)).toBe('')
  })
  it('falls back the same way describeVehicle does', () => {
    expect(vehicleName(null)).toBe('\u2014')
    expect(vehicleName(null, 'vehicle removed')).toBe('vehicle removed')
  })
})
