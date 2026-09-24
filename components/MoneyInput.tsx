'use client'
import { useEffect, useState } from 'react'
import { moneyTextFor, parseMoneyText, sanitizeMoneyText } from '@/lib/money-text'

type Props = {
  value: number
  onChange: (amount: number) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'>

/**
 * A money box that shows exactly what was typed and reports the amount.
 *
 * It is a text box with a decimal keypad rather than a number input: number
 * inputs hide half-typed values like "0." from the page, which is part of how
 * the old boxes lost digits. See lib/money-text.ts.
 */
export function MoneyInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(() => moneyTextFor(value))

  // Follow changes made from outside, such as the form resetting to the
  // balance due after a payment, but never while the box already says that
  // amount: "0.0" and "10." must survive until the next keystroke.
  useEffect(() => {
    if (parseMoneyText(text) !== value) setText(moneyTextFor(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={e => {
        const next = sanitizeMoneyText(e.target.value)
        setText(next)
        onChange(parseMoneyText(next))
      }}
    />
  )
}
