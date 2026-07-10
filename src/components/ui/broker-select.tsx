'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { BROKERS } from '@/lib/brokers'

const OTHER = '__other__'

export function BrokerSelect({ value, onChange, placeholder = 'Pilih broker', customPlaceholder = 'Ketik nama broker…' }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  customPlaceholder?: string
}) {
  const [custom, setCustom] = useState(() => value !== '' && !BROKERS.includes(value))

  return (
    <div className="space-y-2">
      <Select
        value={custom ? OTHER : value}
        onValueChange={v => {
          if (v === OTHER) { setCustom(true); onChange('') }
          else { setCustom(false); onChange(v ?? '') }
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue>{custom ? 'Lainnya…' : (value || placeholder)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {BROKERS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          <SelectItem value={OTHER}>Lainnya (ketik sendiri)</SelectItem>
        </SelectContent>
      </Select>
      {custom && (
        <Input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={customPlaceholder}
        />
      )}
    </div>
  )
}
