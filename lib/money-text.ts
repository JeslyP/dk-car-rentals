/**
 * Turning what someone types into a money box into a number, without losing
 * what they typed along the way.
 *
 * The old boxes bound a number input straight to a number and hid zero with
 * `value={amount || ''}`. Whenever the running value was 0 the box was wiped
 * mid-keystroke, so typing "0" blanked it and typing "0.05" came out as 5:
 * five dollars recorded for five cents. Keeping the text separate from the
 * number is what fixes that. These helpers are the pure part of it.
 */

/**
 * Clean a keystroke's worth of input: digits and a single decimal point, at
 * most two digits after it. Anything else (a pasted "$", a comma, a second
 * point) is dropped rather than rejected, so the box never fights the typist.
 */
export function sanitizeMoneyText(raw: string): string {
  let t = raw.replace(/[^\d.]/g, '')
  const dot = t.indexOf('.')
  if (dot !== -1) t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, '').slice(0, 2)
  return t
}

/** The amount the text stands for. Empty, or a lone ".", is 0. */
export function parseMoneyText(text: string): number {
  if (text === '' || text === '.') return 0
  const n = Number(text)
  return Number.isFinite(n) ? n : 0
}

/** How a stored amount should first appear in the box: blank for 0. */
export function moneyTextFor(value: number): string {
  return value ? String(value) : ''
}
