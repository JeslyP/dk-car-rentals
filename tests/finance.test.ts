import { describe, expect, it } from 'vitest'
import {
  csvCell, currentMonthKey, expensesCsv, monthEnd, monthKey, monthLabel, monthStart,
  monthsBetween, periodRange, shiftMonthKey, shortMonthLabel, statementCsv, summarise, toCsv, vehicleLabel,
} from '@/lib/finance'

const vehicles = [
  { id: 'v1', year: 2018, make: 'Honda', model: 'Fit' },
  { id: 'v2', year: 2012, make: 'Toyota', model: 'Corolla' },
]

const rentals = [
  { id: 'r1', vehicle_id: 'v1', start_date: '2026-03-02', end_date: '2026-03-06', total_charge: 350, amount_paid: 350 },
  { id: 'r2', vehicle_id: 'v2', start_date: '2026-03-20', end_date: '2026-03-25', total_charge: 400, amount_paid: 100 },
  { id: 'r3', vehicle_id: 'v1', start_date: '2026-04-01', end_date: '2026-04-03', total_charge: 210, amount_paid: 0 },
]

const payments = [
  { id: 'p1', rental_id: 'r1', paid_on: '2026-03-02', amount: 200 },
  { id: 'p2', rental_id: 'r1', paid_on: '2026-04-05', amount: 150 }, // paid late: counts in April
  { id: 'p3', rental_id: 'r2', paid_on: '2026-03-20', amount: 100 },
  { id: 'p4', rental_id: null, paid_on: '2026-03-15', amount: 40 },  // rental since deleted
]

const expenses = [
  { id: 'e1', vehicle_id: 'v1', spent_on: '2026-03-04', category: 'fuel', amount: 50 },
  { id: 'e2', vehicle_id: 'v1', spent_on: '2026-03-11', category: 'repair', amount: 300 },
  { id: 'e3', vehicle_id: 'v2', spent_on: '2026-03-28', category: 'fuel', amount: 25 },
  { id: 'e4', vehicle_id: null, spent_on: '2026-03-31', category: 'insurance', amount: 120 },
  { id: 'e5', vehicle_id: 'v1', spent_on: '2026-04-02', category: 'fuel', amount: 30 },
]

const input = { rentals, payments, expenses, vehicles }
const march = summarise(input, '2026-03-01', '2026-03-31')

describe('month helpers', () => {
  it('derives keys, bounds and labels', () => {
    expect(monthKey('2026-03-15')).toBe('2026-03')
    expect(monthStart('2026-03')).toBe('2026-03-01')
    expect(monthEnd('2026-03')).toBe('2026-03-31')
    expect(monthEnd('2026-02')).toBe('2026-02-28')
    expect(monthEnd('2028-02')).toBe('2028-02-29')
    expect(monthLabel('2026-03')).toBe('March 2026')
    expect(shortMonthLabel('2026-03')).toBe('Mar 26')
  })
  it('shifts months across year boundaries', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12')
    expect(shiftMonthKey('2026-12', 1)).toBe('2027-01')
    expect(shiftMonthKey('2026-06', -12)).toBe('2025-06')
  })
  it('lists months in a range', () => {
    expect(monthsBetween('2026-01', '2026-04')).toEqual(['2026-01', '2026-02', '2026-03', '2026-04'])
    expect(monthsBetween('2026-03', '2026-03')).toEqual(['2026-03'])
    expect(monthsBetween('2026-05', '2026-03')).toEqual([])
  })
  it('reads the current month from a date', () => {
    expect(currentMonthKey(new Date(2026, 8, 21))).toBe('2026-09')
  })
  it('turns a period into a date range', () => {
    expect(periodRange({ kind: 'month', month: '2026-02' })).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(periodRange({ kind: 'year', year: 2026 })).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange({ kind: 'custom', from: 'a', to: 'b' })).toEqual({ from: 'a', to: 'b' })
  })
})

describe('summarise totals', () => {
  it('counts money on the date it was received, not the rental date', () => {
    // 200 + 100 + 40 in March; the late 150 belongs to April.
    expect(march.collected).toBe(340)
    const april = summarise(input, '2026-04-01', '2026-04-30')
    expect(april.collected).toBe(150)
  })
  it('totals expenses in the period', () => {
    expect(march.expenses).toBe(495)
  })
  it('nets profit as received minus costs', () => {
    expect(march.net).toBe(340 - 495)
    expect(march.net).toBeLessThan(0)
  })
  it('reports invoiced and outstanding separately from cash', () => {
    expect(march.charged).toBe(750)
    expect(march.outstanding).toBe(300)
    expect(march.rentalCount).toBe(2)
  })
  it('counts the rows behind each figure', () => {
    expect(march.paymentCount).toBe(3)
    expect(march.expenseCount).toBe(4)
  })
  it('computes margin only when money came in', () => {
    const empty = summarise({ rentals: [], payments: [], expenses: [], vehicles: [] }, '2026-01-01', '2026-01-31')
    expect(empty.margin).toBe(0)
    expect(empty.net).toBe(0)
    expect(march.margin).toBeCloseTo((340 - 495) / 340)
  })
  it('handles numeric strings from the database', () => {
    const s = summarise({
      vehicles,
      rentals: [{ id: 'r1', vehicle_id: 'v1', start_date: '2026-03-01', end_date: '2026-03-02', total_charge: '100.50', amount_paid: '50.25' }],
      payments: [{ id: 'p1', rental_id: 'r1', paid_on: '2026-03-01', amount: '50.25' }],
      expenses: [{ id: 'e1', vehicle_id: 'v1', spent_on: '2026-03-01', category: 'fuel', amount: '10.10' }],
    }, '2026-03-01', '2026-03-31')
    expect(s.collected).toBe(50.25)
    expect(s.expenses).toBe(10.1)
    expect(s.net).toBe(40.15)
    expect(s.outstanding).toBe(50.25)
  })
})

describe('summarise by category', () => {
  it('groups and sorts by amount with readable labels', () => {
    expect(march.byCategory.map(c => [c.category, c.amount])).toEqual([
      ['repair', 300], ['insurance', 120], ['fuel', 75],
    ])
    expect(march.byCategory[0].label).toBe('Repairs')
    expect(march.byCategory[0].share).toBeCloseTo(300 / 495)
  })
})

describe('summarise by vehicle', () => {
  it('attributes a payment to the vehicle of its rental', () => {
    const v1 = march.byVehicle.find(v => v.vehicleId === 'v1')!
    expect(v1.collected).toBe(200)
    expect(v1.expenses).toBe(350)
    expect(v1.net).toBe(-150)
    expect(v1.rentals).toBe(1)
  })
  it('lists a vehicle that earned nothing but still cost money', () => {
    const idle = summarise({ rentals: [], payments: [], expenses: [{ id: 'e', vehicle_id: 'v2', spent_on: '2026-03-01', category: 'insurance', amount: 80 }], vehicles }, '2026-03-01', '2026-03-31')
    const v2 = idle.byVehicle.find(v => v.vehicleId === 'v2')!
    expect(v2.collected).toBe(0)
    expect(v2.expenses).toBe(80)
    expect(v2.net).toBe(-80)
    expect(idle.byVehicle.find(v => v.vehicleId === 'v1')!.net).toBe(0)
  })
  it('buckets orphaned money under a single unassigned row', () => {
    const none = march.byVehicle.find(v => v.vehicleId === null)!
    expect(none.collected).toBe(40)   // payment whose rental was deleted
    expect(none.expenses).toBe(120)   // business-wide insurance
    expect(none.label).toBe('Not assigned to a vehicle')
  })
  it('sorts most profitable first', () => {
    const nets = march.byVehicle.map(v => v.net)
    expect(nets).toEqual([...nets].sort((a, b) => b - a))
  })
  it('labels vehicles and missing vehicles', () => {
    expect(vehicleLabel(vehicles[0])).toBe('2018 Honda Fit')
    expect(vehicleLabel(null)).toBe('Not assigned to a vehicle')
  })
})

describe('summarise by month', () => {
  it('splits a year into months that add up to the whole', () => {
    const year = summarise(input, '2026-01-01', '2026-12-31')
    expect(year.byMonth).toHaveLength(12)
    const m = Object.fromEntries(year.byMonth.map(x => [x.month, x]))
    expect(m['2026-03'].collected).toBe(340)
    expect(m['2026-04'].collected).toBe(150)
    expect(m['2026-01'].collected).toBe(0)
    const summed = year.byMonth.reduce((s, x) => s + x.collected, 0)
    expect(summed).toBe(year.collected)
  })
  it('clips the first and last month to the requested range', () => {
    const partial = summarise(input, '2026-03-12', '2026-04-02')
    // From the 12th onward March holds only the 15th (40) and 20th (100)
    // payments; the 2nd (200) falls before the window.
    expect(partial.byMonth.find(m => m.month === '2026-03')!.collected).toBe(140)
    // April is cut off on the 2nd, so only that day's fuel counts.
    expect(partial.byMonth.find(m => m.month === '2026-04')!.expenses).toBe(30)
    expect(partial.collected).toBe(140)
  })
})

describe('csv', () => {
  it('quotes separators and newlines', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"')
    expect(csvCell(null)).toBe('')
  })
  it('defuses text a spreadsheet would run as a formula', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('-1-2')).toBe("'-1-2")
    expect(csvCell('+A1')).toBe("'+A1")
  })
  it('leaves real numbers alone so a loss imports as a number', () => {
    expect(csvCell('-155.00')).toBe('-155.00')
    expect(csvCell(-155)).toBe('-155')
    expect(csvCell('-0.5')).toBe('-0.5')
    expect(csvCell('+12')).toBe('+12')
  })
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('a,b\r\n1,2')
  })
  it('writes a statement containing the headline figures', () => {
    const csv = statementCsv(march, 'March 2026')
    expect(csv).toContain('Money collected,340.00')
    expect(csv).toContain('Expenses,495.00')
    expect(csv).toContain('Net profit,-155.00')
    expect(csv).toContain('2018 Honda Fit')
    expect(csv).toContain('Repairs,300.00')
  })
  it('writes one row per expense', () => {
    const csv = expensesCsv([{ ...expenses[1], vehicle: vehicles[0], vendor: 'Ace Garage', description: 'brake pads' }])
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Date,Vehicle,Category,Amount,Vendor,Description')
    expect(lines[1]).toBe('2026-03-11,2018 Honda Fit,Repairs,300.00,Ace Garage,brake pads')
  })
})
