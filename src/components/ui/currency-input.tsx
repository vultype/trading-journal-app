'use client'

import { forwardRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | ''
  onChange: (value: number | '') => void
}

function fmtDisplay(n: number) {
  return new Intl.NumberFormat('id-ID').format(n)
}

function parseInput(s: string): number | '' {
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return ''
  const n = parseInt(digits, 10)
  return isNaN(n) ? '' : n
}

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, ...props }, ref) => {
    const [display, setDisplay] = useState(value !== '' ? fmtDisplay(value as number) : '')

    useEffect(() => {
      setDisplay(value !== '' ? fmtDisplay(value as number) : '')
    }, [value])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const parsed = parseInput(e.target.value)
      setDisplay(parsed !== '' ? fmtDisplay(parsed) : '')
      onChange(parsed)
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        className={cn(
          'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors',
          'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      />
    )
  }
)
CurrencyInput.displayName = 'CurrencyInput'
