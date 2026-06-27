'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  required?: boolean
  className?: string
}

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']
const DAYS   = ['Min','Sen','Sel','Rab','Kam','Jum','Sab']

function toDate(s: string) {
  if (!s) return undefined
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatDisplay(s: string) {
  if (!s) return 'Pilih tanggal'
  const d = toDate(s)!
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function DatePicker({ value, onChange, required, className }: DatePickerProps) {
  const [open, setOpen]     = useState(false)
  const [month, setMonth]   = useState<Date>(() => toDate(value) ?? new Date())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  useEffect(() => {
    if (value) setMonth(toDate(value)!)
  }, [value])

  function handleSelect(d: Date | undefined) {
    if (d) { onChange(toStr(d)); setOpen(false) }
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-left hover:bg-muted/50 transition-colors"
      >
        <CalendarIcon size={13} className="text-muted-foreground shrink-0" />
        <span className={value ? '' : 'text-muted-foreground'}>{formatDisplay(value)}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 rounded-xl border border-border bg-popover shadow-lg p-3">
          {/* Header nav */}
          <div className="flex items-center justify-between mb-3 px-1">
            <button type="button" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()-1))}
              className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronLeft size={15} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold">
              {MONTHS[month.getMonth()]} {month.getFullYear()}
            </span>
            <button type="button" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()+1))}
              className="p-1 rounded hover:bg-muted transition-colors">
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          </div>

          <DayPicker
            mode="single"
            selected={toDate(value)}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonth}
            weekStartsOn={1}
            formatters={{
              formatWeekdayName: (d) => DAYS[d.getDay()],
            }}
            classNames={{
              months:      'w-full',
              month:       'w-full',
              month_caption: 'hidden',
              nav:         'hidden',
              weekdays:    'grid grid-cols-7 mb-1',
              weekday:     'text-center text-[11px] font-medium text-muted-foreground py-1',
              weeks:       'w-full',
              week:        'grid grid-cols-7',
              day:         'flex items-center justify-center p-0.5',
              day_button:  cn(
                'h-8 w-8 rounded-lg text-sm transition-colors flex items-center justify-center w-full',
                'hover:bg-muted cursor-pointer'
              ),
              selected:    '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary/90',
              today:       '[&>button]:font-bold [&>button]:border [&>button]:border-primary/50',
              outside:     '[&>button]:text-muted-foreground/40',
              disabled:    '[&>button]:opacity-30 [&>button]:cursor-not-allowed',
            }}
          />
        </div>
      )}
      {required && <input type="hidden" value={value} required />}
    </div>
  )
}
