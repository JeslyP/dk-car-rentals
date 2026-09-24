import { describe, expect, it } from 'vitest'
import { moneyTextFor, parseMoneyText, sanitizeMoneyText } from '@/lib/money-text'

/** Type a string one key at a time, the way a person does. */
function typeInto(keys: string): { text: string; amount: number } {
  let text = ''
  for (const k of keys) text = sanitizeMoneyText(text + k)
  return { text, amount: parseMoneyText(text) }
}

describe('typing an amount one key at a time', () => {
  it('keeps a typed 0 visible instead of blanking the box', () => {
    expect(typeInto('0')).toEqual({ text: '0', amount: 0 })
  })
  it('records cents as cents: 0.01 is one cent, not a dollar', () => {
    // The old box turned this into 1.
    expect(typeInto('0.01')).toEqual({ text: '0.01', amount: 0.01 })
    expect(typeInto('0.05')).toEqual({ text: '0.05', amount: 0.05 })
    expect(typeInto('0.09')).toEqual({ text: '0.09', amount: 0.09 })
  })
  it('keeps the leading zero in 0.50', () => {
    expect(typeInto('0.50')).toEqual({ text: '0.50', amount: 0.5 })
  })
  it('handles ordinary amounts', () => {
    expect(typeInto('240')).toEqual({ text: '240', amount: 240 })
    expect(typeInto('239.99')).toEqual({ text: '239.99', amount: 239.99 })
    expect(typeInto('10.05')).toEqual({ text: '10.05', amount: 10.05 })
  })
  it('survives a half-typed value like "10."', () => {
    expect(typeInto('10.')).toEqual({ text: '10.', amount: 10 })
  })
})

describe('sanitizeMoneyText', () => {
  it('drops a pasted currency sign and thousands separator', () => {
    expect(sanitizeMoneyText('$1,240.50')).toBe('1240.50')
  })
  it('keeps only the first decimal point', () => {
    expect(sanitizeMoneyText('1.2.3')).toBe('1.23')
  })
  it('stops at two decimals', () => {
    expect(sanitizeMoneyText('9.999')).toBe('9.99')
  })
  it('refuses a minus sign, since payments and costs are never negative', () => {
    expect(sanitizeMoneyText('-5')).toBe('5')
  })
  it('drops letters', () => {
    expect(sanitizeMoneyText('12abc')).toBe('12')
  })
})

describe('parseMoneyText', () => {
  it('treats an empty box and a lone point as zero', () => {
    expect(parseMoneyText('')).toBe(0)
    expect(parseMoneyText('.')).toBe(0)
  })
  it('reads a leading point', () => {
    expect(parseMoneyText('.5')).toBe(0.5)
  })
})

describe('moneyTextFor', () => {
  it('shows an empty box for zero so the placeholder shows through', () => {
    expect(moneyTextFor(0)).toBe('')
  })
  it('shows a stored amount as-is', () => {
    expect(moneyTextFor(239.99)).toBe('239.99')
  })
})
