import { describe, expect, it } from 'vitest'
import { pickWritable, validateBookingRequest, validateDateRange, validateWrite } from '@/lib/validation'

const good = { name: 'Jane Doe', phone: '555-123-4567', email: 'jane@example.com', start_date: '2026-06-01', end_date: '2026-06-03', message: 'hi' }

describe('validateBookingRequest', () => {
  it('accepts a valid request and normalises blanks to null', () => {
    const r = validateBookingRequest({ ...good, email: '  ', message: '', requested_vehicle_id: '' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.email).toBeNull()
      expect(r.value.message).toBeNull()
      expect(r.value.requested_vehicle_id).toBeNull()
      expect(r.value.name).toBe('Jane Doe')
    }
  })
  it('rejects bad input', () => {
    expect(validateBookingRequest(null).ok).toBe(false)
    expect(validateBookingRequest({ ...good, name: 'J' }).ok).toBe(false)
    expect(validateBookingRequest({ ...good, phone: '12' }).ok).toBe(false)
    expect(validateBookingRequest({ ...good, email: 'nope' }).ok).toBe(false)
    expect(validateBookingRequest({ ...good, end_date: '2026-05-30' }).ok).toBe(false)
    expect(validateBookingRequest({ ...good, start_date: '2026-13-01' }).ok).toBe(false)
    expect(validateBookingRequest({ ...good, requested_vehicle_id: 'not-a-uuid' }).ok).toBe(false)
  })
  it('accepts a uuid vehicle id', () => {
    const r = validateBookingRequest({ ...good, requested_vehicle_id: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' })
    expect(r.ok).toBe(true)
  })
  it('truncates over-long fields instead of failing', () => {
    const r = validateBookingRequest({ ...good, message: 'x'.repeat(5000) })
    expect(r.ok && r.value.message?.length).toBe(2000)
  })
})

describe('validateDateRange', () => {
  it('validates query params', () => {
    expect(validateDateRange('2026-01-01', '2026-01-02').ok).toBe(true)
    expect(validateDateRange('2026-01-02', '2026-01-01').ok).toBe(false)
    expect(validateDateRange(undefined, '2026-01-01').ok).toBe(false)
  })
})

describe('pickWritable', () => {
  it('drops columns that are not writable', () => {
    const out = pickWritable('vehicles', { make: 'Honda', id: 'x', created_at: 'y', daily_rate: 70 })
    expect(out).toEqual({ make: 'Honda', daily_rate: 70 })
  })
  it('turns empty strings into null', () => {
    expect(pickWritable('renters', { name: 'A', email: '' })).toEqual({ name: 'A', email: null })
  })
  it('only allows status on requests', () => {
    expect(pickWritable('rental_requests', { status: 'approved', name: 'hack' })).toEqual({ status: 'approved' })
  })
  it('refuses to let a rental write its own payment totals', () => {
    // Money only moves through the payments table, so these are dropped.
    const out = pickWritable('rentals', { total_charge: 100, amount_paid: 999, payment_status: 'paid' })
    expect(out).toEqual({ total_charge: 100 })
  })
})

describe('validateWrite', () => {
  it('requires fields on create but not on update', () => {
    expect(validateWrite('renters', { phone: '1' }, false)).toMatch(/Name is required/)
    expect(validateWrite('renters', { phone: '1' }, true)).toBeNull()
  })
  it('checks rental dates and amounts', () => {
    const base = { vehicle_id: 'v', renter_id: 'r', start_date: '2026-01-05', end_date: '2026-01-02', daily_rate: 10, total_charge: 10 }
    expect(validateWrite('rentals', base, false)).toMatch(/end date must be on or after/)
    expect(validateWrite('rentals', { ...base, end_date: '2026-01-06', daily_rate: -1 }, false)).toMatch(/Daily rate/)
    expect(validateWrite('rentals', { ...base, end_date: '2026-01-06' }, false)).toBeNull()
  })
  it('validates expenses', () => {
    const base = { spent_on: '2026-03-01', category: 'fuel', amount: 40 }
    expect(validateWrite('expenses', base, false)).toBeNull()
    expect(validateWrite('expenses', { category: 'fuel', amount: 40 }, false)).toMatch(/Date is required/)
    expect(validateWrite('expenses', { ...base, category: 'beer' }, false)).toMatch(/category/)
    expect(validateWrite('expenses', { ...base, spent_on: '2026-02-31' }, false)).toMatch(/date/)
    expect(validateWrite('expenses', { ...base, amount: -5 }, false)).toMatch(/Amount/)
    expect(validateWrite('expenses', { ...base, odometer: -1 }, false)).toMatch(/Odometer/)
  })
  it('validates payments', () => {
    const base = { rental_id: 'r', paid_on: '2026-03-01', amount: 50 }
    expect(validateWrite('payments', base, false)).toBeNull()
    expect(validateWrite('payments', { ...base, amount: 0 }, false)).toMatch(/greater than zero/)
    expect(validateWrite('payments', { ...base, paid_on: 'soon' }, false)).toMatch(/date/)
    expect(validateWrite('payments', { ...base, method: 'crypto' }, false)).toMatch(/method/)
    expect(validateWrite('payments', { paid_on: '2026-03-01', amount: 50 }, false)).toMatch(/Rental is required/)
  })
  it('rejects invalid request status', () => {
    expect(validateWrite('rental_requests', { status: 'done' }, true)).toMatch(/not valid/)
    expect(validateWrite('rental_requests', { status: 'rejected' }, true)).toBeNull()
  })
})
