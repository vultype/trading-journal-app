'use client'

import { forwardRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import type { AppSettings } from '@/types'

type Ccy = AppSettings['currency']

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | ''
  onChange: (value: number | '') => void
  /**
   * Paksa mata uang tertentu. Kosongkan untuk mengikuti pengaturan akun.
   * Dipakai di tempat yang mata uangnya ditentukan objeknya sendiri — mis. saldo
   * awal akun broker, yang punya kolom currency terpisah dari pengaturan global.
   */
  currency?: Ccy
}

// IDR tidak mengenal sen dalam praktik sehari-hari, jadi dipaksa bilangan bulat.
// USD/USDT justru sebaliknya: memaksa bulat membuat "12.50" mustahil diketik dan
// nilainya diam-diam dibulatkan.
const isIdr = (c: Ccy) => c === 'IDR'
const localeOf = (c: Ccy) => (isIdr(c) ? 'id-ID' : 'en-US')
const decimalsOf = (c: Ccy) => (isIdr(c) ? 0 : 2)

function fmtDisplay(n: number, c: Ccy) {
  return new Intl.NumberFormat(localeOf(c), {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimalsOf(c),
  }).format(n)
}

// Mengembalikan { n, raw }: `raw` adalah teks yang harus TETAP ditampilkan.
//
// Angka tidak diformat ulang selagi user mengetik bagian desimal. Tanpa ini,
// mengetik "12." langsung berubah jadi "12" — titiknya hilang, dan desimal
// menjadi tidak mungkin diketik sama sekali.
function parseInput(s: string, c: Ccy): { n: number | ''; raw: string | null } {
  if (isIdr(c)) {
    const digits = s.replace(/[^\d]/g, '')
    if (!digits) return { n: '', raw: null }
    const n = parseInt(digits, 10)
    return { n: isNaN(n) ? '' : n, raw: null }
  }

  // USD/USDT: koma = pemisah ribuan (dibuang), titik = desimal.
  let t = s.replace(/,/g, '').replace(/[^\d.]/g, '')
  const first = t.indexOf('.')
  if (first !== -1) t = t.slice(0, first + 1) + t.slice(first + 1).replace(/\./g, '')
  const [intPart = '', decPart] = t.split('.')
  if (!intPart && decPart === undefined) return { n: '', raw: null }

  const dec = decPart === undefined ? undefined : decPart.slice(0, 2)
  const n = parseFloat(`${intPart || '0'}.${dec || '0'}`)
  if (!Number.isFinite(n)) return { n: '', raw: null }

  // Selama masih mengetik desimal ("12." atau "12.5"), tampilkan apa adanya.
  const sedangKetikDesimal = decPart !== undefined && (dec === '' || dec!.length < 2)
  if (sedangKetikDesimal) {
    const intFmt = intPart ? new Intl.NumberFormat('en-US').format(parseInt(intPart, 10)) : '0'
    return { n, raw: `${intFmt}.${dec}` }
  }
  return { n, raw: null }
}

export const CurrencyInput = forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, className, currency, ...props }, ref) => {
    const { settings } = useStore()
    const ccy: Ccy = currency ?? settings.currency ?? 'IDR'

    const [display, setDisplay] = useState(value !== '' ? fmtDisplay(value as number, ccy) : '')
    // Menahan pemformatan ulang dari luar selagi user mengetik desimal.
    const [typing, setTyping] = useState(false)

    useEffect(() => {
      if (typing) return
      setDisplay(value !== '' ? fmtDisplay(value as number, ccy) : '')
    }, [value, ccy, typing])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const { n, raw } = parseInput(e.target.value, ccy)
      setTyping(raw !== null)
      setDisplay(raw !== null ? raw : n !== '' ? fmtDisplay(n, ccy) : '')
      onChange(n)
    }

    return (
      <input
        {...props}
        ref={ref}
        type="text"
        // 'decimal' memunculkan tombol titik di papan ketik ponsel; 'numeric'
        // tidak, sehingga desimal mustahil diketik di HP.
        inputMode={isIdr(ccy) ? 'numeric' : 'decimal'}
        value={display}
        onBlur={e => { setTyping(false); props.onBlur?.(e) }}
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
