'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import { CurrencyInput } from '@/components/ui/currency-input'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import { useStore } from '@/lib/store'
import {
  TrendingUp, TrendingDown, ExternalLink, Trash2, Check, X, Clock, Calendar,
  ImageOff, Loader2, AlertTriangle, ChevronDown, ArrowLeftRight, Pencil, ZoomIn,
} from 'lucide-react'
import type { Trade } from '@/types'

// ── Types & helpers ────────────────────────────────────────────────────────────

type MarketStructure = 'bullish' | 'bearish' | 'ranging' | ''

type EditForm = {
  pair: string
  date: string
  entry_time: string
  direction: 'long' | 'short'
  result: 'win' | 'loss' | 'breakeven'
  pnl: number | ''
  strategy: string
  market_structure: MarketStructure
  followed_plan: 'yes' | 'no' | ''
  know_direction: 'yes' | 'no' | ''
  screenshot_url: string
  note: string
  ai_analysis: string
  is_overtrade: boolean
}

const SEPARATOR = '--- Analisa by Claude ---'

function parseNote(raw: string | undefined | null): { catatan: string; analisa: string } {
  if (!raw) return { catatan: '', analisa: '' }
  const idx = raw.indexOf(SEPARATOR)
  if (idx === -1) return { catatan: raw.trim(), analisa: '' }
  return {
    catatan: raw.slice(0, idx).trim(),
    analisa: raw.slice(idx + SEPARATOR.length).trim(),
  }
}

function buildNote(catatan: string, analisa: string): string {
  const parts = [catatan, analisa ? `${SEPARATOR}\n${analisa}` : ''].filter(Boolean)
  return parts.join('\n\n')
}

function toEditForm(t: Trade): EditForm {
  const { catatan, analisa } = parseNote(t.note)
  return {
    pair:             t.pair,
    date:             t.date,
    entry_time:       t.entry_time ?? '',
    direction:        t.direction,
    result:           t.result,
    pnl:              Math.abs(t.pnl),
    strategy:         t.strategy ?? '',
    market_structure: t.market_structure ?? '',
    followed_plan:    t.followed_plan === true ? 'yes' : t.followed_plan === false ? 'no' : '',
    know_direction:   t.know_direction === true ? 'yes' : t.know_direction === false ? 'no' : '',
    screenshot_url:   t.screenshot_url ?? '',
    note:             catatan,
    ai_analysis:      analisa,
    is_overtrade:     t.is_overtrade ?? false,
  }
}

// ── Markdown renderer (for Claude analysis) ────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*'))   return <em key={i} className="italic">{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`'))   return <code key={i} className="bg-muted/80 px-1 rounded text-xs font-mono">{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  function flush() {
    if (!listItems.length) return
    elements.push(
      <ul key={`ul-${elements.length}`} className="space-y-1 my-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex gap-2 items-start text-sm leading-relaxed">
            <span className="text-purple-400 text-xs shrink-0 mt-1">•</span>
            <span className="text-foreground/85">{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((line, i) => {
    const t = line.trim()
    if (!t) { flush(); elements.push(<div key={`b${i}`} className="h-1" />); return }
    if (t.startsWith('### ')) { flush(); elements.push(<p key={i} className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mt-3 mb-1">{t.slice(4)}</p>); return }
    if (t.startsWith('## '))  { flush(); elements.push(<p key={i} className="text-sm font-bold text-foreground mt-2 mb-0.5">{t.slice(3)}</p>); return }
    if (t.startsWith('# '))   { flush(); elements.push(<p key={i} className="text-sm font-bold text-foreground mt-2 mb-0.5">{t.slice(2)}</p>); return }
    const bullet = t.match(/^(?:[-•*]|\d+\.)\s+(.+)/)
    if (bullet) { listItems.push(bullet[1]); return }
    flush()
    elements.push(<p key={i} className="text-sm leading-relaxed text-foreground/85">{renderInline(t)}</p>)
  })
  flush()
  return <div className="space-y-1">{elements}</div>
}

// ── Collapsible analisa block ──────────────────────────────────────────────────

function AnalisaBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const preview = text.split('\n')
    .map(l => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim())
    .find(l => l.length > 0) ?? ''

  return (
    <div className="rounded-xl bg-purple-500/5 border border-purple-500/20 overflow-hidden">
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-500/5 transition-colors">
        <span className="text-[10px] uppercase tracking-widest font-bold text-purple-400 flex items-center gap-2">
          <span className="text-base leading-none">✦</span> Analisa by Claude
        </span>
        <ChevronDown size={14} className={`text-purple-400/60 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {!open && preview && (
        <p className="px-4 pb-3.5 pt-1.5 text-xs text-muted-foreground line-clamp-2 border-t border-purple-500/10">
          {preview}…
        </p>
      )}
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-purple-500/10">
          <MarkdownText text={text} />
        </div>
      )}
    </div>
  )
}

// ── Direction vs Market Structure card ────────────────────────────────────────

function DirectionCard({ market_structure, direction }: {
  market_structure?: Trade['market_structure']
  direction: 'long' | 'short'
}) {
  if (!market_structure) return null

  if (market_structure === 'ranging') {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3">
        <ArrowLeftRight size={14} className="text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-yellow-400">Market Ranging / Sideways</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Tidak ada tren dominan — waspadai false breakout di kedua arah</p>
        </div>
      </div>
    )
  }

  const isBullish = market_structure === 'bullish'
  const isLong    = direction === 'long'
  const searah    = (isBullish && isLong) || (!isBullish && !isLong)

  return searah ? (
    <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
      <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-emerald-400">Entry Searah Market Structure</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {isBullish ? '🐂 Bullish' : '🐻 Bearish'} + {isLong ? 'Long' : 'Short'} — mengikuti tren utama
        </p>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3">
      <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-red-400">⚠️ Entry Berlawanan Arah!</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {isBullish ? '🐂 Bullish' : '🐻 Bearish'} + {isLong ? 'Long' : 'Short'} — counter-trend, risiko lebih tinggi
        </p>
      </div>
    </div>
  )
}

// ── Detail row ────────────────────────────────────────────────────────────────

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start justify-between py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm font-semibold text-right ml-4 leading-snug ${className ?? ''}`}>{value}</span>
    </div>
  )
}

// ── Screenshot with lightbox trigger ─────────────────────────────────────────

function Screenshot({ url, onExpand }: { url: string; onExpand: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  return (
    <div className="rounded-xl overflow-hidden border border-border/40">
      <div className="px-3.5 py-2 bg-muted/25 border-b border-border/30 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50">Chart Screenshot</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onExpand}
            className="text-[10px] text-primary/60 hover:text-primary flex items-center gap-1 transition-colors font-medium">
            <ZoomIn size={10}/> Fullscreen
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-primary/60 hover:text-primary flex items-center gap-1 transition-colors font-medium">
            <ExternalLink size={10}/> Buka
          </a>
        </div>
      </div>

      {status === 'error' ? (
        <div className="py-8 flex flex-col items-center gap-3 bg-muted/10">
          <ImageOff size={26} className="text-muted-foreground/25"/>
          <p className="text-xs text-muted-foreground">Gambar tidak bisa ditampilkan langsung.</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold text-primary flex items-center gap-1.5 hover:underline">
            <ExternalLink size={11}/> Buka di TradingView
          </a>
        </div>
      ) : (
        <div className="relative bg-black/20 group cursor-zoom-in" onClick={onExpand}>
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center min-h-[80px]">
              <Loader2 size={18} className="animate-spin text-muted-foreground/30"/>
            </div>
          )}
          <img
            src={url}
            alt="Trade chart screenshot"
            className={`w-full max-h-60 object-contain transition-opacity duration-300 ${status === 'ok' ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
          />
          {status === 'ok' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
              <ZoomIn size={22} className="text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow-lg"/>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Lightbox portal ───────────────────────────────────────────────────────────

function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button onClick={onClose}
        className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10">
        <X size={20}/>
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="absolute bottom-5 right-5 flex items-center gap-1.5 text-xs text-white/40 hover:text-white/90 transition-colors"
        onClick={e => e.stopPropagation()}>
        <ExternalLink size={12}/> Buka di TradingView
      </a>
      <img
        src={url}
        alt="Trade chart fullscreen"
        className="max-w-[95vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>,
    document.body
  )
}

// ── Toggle button (reused in edit form) ───────────────────────────────────────

function Tog({ active, onClick, activeClass, children }: {
  active: boolean; onClick: () => void; activeClass: string; children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-semibold transition-all
        ${active ? activeClass : 'border-border/50 text-muted-foreground hover:bg-muted/60'}`}>
      {children}
    </button>
  )
}

// ── Inner component (all logic) ───────────────────────────────────────────────

function Inner({ t, onClose, onDelete, fmt }: {
  t: Trade; onClose: () => void; onDelete: (id: string) => void; fmt: (n: number) => string
}) {
  const { updateTrade, settings } = useStore()
  const [editing, setEditing] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [ef, setEf] = useState<EditForm>(() => toEditForm(t))

  useEffect(() => {
    setEf(toEditForm(t))
    setEditing(false)
    setLightboxUrl(null)
  }, [t.id])

  function set<K extends keyof EditForm>(k: K, v: EditForm[K]) {
    setEf(p => ({ ...p, [k]: v }))
  }

  function handleSave() {
    const pnlVal = Number(ef.pnl)
    if (!pnlVal || isNaN(pnlVal) || pnlVal <= 0) return
    updateTrade(t.id, {
      pair:             ef.pair,
      date:             ef.date,
      entry_time:       ef.entry_time || undefined,
      direction:        ef.direction,
      result:           ef.result,
      pnl:              ef.result === 'loss' || ef.is_overtrade ? -Math.abs(pnlVal) : Math.abs(pnlVal),
      strategy:         ef.strategy || undefined,
      market_structure: ef.market_structure || undefined,
      followed_plan:    ef.followed_plan === 'yes' ? true : ef.followed_plan === 'no' ? false : undefined,
      know_direction:   ef.know_direction === 'yes' ? true : ef.know_direction === 'no' ? false : undefined,
      screenshot_url:   ef.screenshot_url || undefined,
      note:             buildNote(ef.note, ef.ai_analysis) || undefined,
      is_overtrade:     ef.is_overtrade,
    })
    setEditing(false)
  }

  const { catatan, analisa } = parseNote(t.note)
  const resultColor = t.result === 'win' ? 'text-emerald-400' : t.result === 'loss' ? 'text-red-400' : 'text-yellow-400'
  const heroBg      = t.pnl >= 0
    ? 'bg-gradient-to-b from-emerald-500/10 to-emerald-500/3 border-emerald-500/15'
    : 'bg-gradient-to-b from-red-500/10 to-red-500/3 border-red-500/15'

  // ── Edit mode ─────────────────────────────────────────────────────────────
  const editNode = editing ? (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-base font-bold">Edit Trade</p>
        <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground transition-colors">
          <X size={18}/>
        </button>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Date</Label>
          <DatePicker value={ef.date} onChange={v => set('date', v)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Entry Time</Label>
          <Input type="time" value={ef.entry_time} onChange={e => set('entry_time', e.target.value)} />
        </div>
      </div>

      {/* Pair */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Pair</Label>
        <div className="flex gap-2">
          <button type="button" onClick={() => set('pair', 'XAUUSD')}
            className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all
              ${ef.pair === 'XAUUSD' ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border/50 text-muted-foreground hover:bg-muted/60'}`}>
            XAUUSD
          </button>
          <Input
            placeholder="Other pair…"
            value={ef.pair !== 'XAUUSD' ? ef.pair : ''}
            onChange={e => set('pair', e.target.value || 'XAUUSD')}
            className="text-xs h-9"
          />
        </div>
      </div>

      {/* Market Structure */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Market Structure</Label>
        <div className="flex gap-2">
          <Tog active={ef.market_structure === 'bullish'} activeClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            onClick={() => set('market_structure', ef.market_structure === 'bullish' ? '' : 'bullish')}>🐂 Bullish</Tog>
          <Tog active={ef.market_structure === 'bearish'} activeClass="bg-red-500/10 border-red-500/30 text-red-400"
            onClick={() => set('market_structure', ef.market_structure === 'bearish' ? '' : 'bearish')}>🐻 Bearish</Tog>
          <Tog active={ef.market_structure === 'ranging'} activeClass="bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
            onClick={() => set('market_structure', ef.market_structure === 'ranging' ? '' : 'ranging')}>↔ Ranging</Tog>
        </div>
      </div>

      {/* Direction */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Direction</Label>
        <div className="flex gap-2">
          <Tog active={ef.direction === 'long'} activeClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            onClick={() => set('direction', 'long')}>↑ Long / Buy</Tog>
          <Tog active={ef.direction === 'short'} activeClass="bg-red-500/10 border-red-500/30 text-red-400"
            onClick={() => set('direction', 'short')}>↓ Short / Sell</Tog>
        </div>
      </div>

      {/* Result */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Result</Label>
        <div className="flex gap-2">
          <Tog active={ef.result === 'win'} activeClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            onClick={() => set('result', 'win')}>✓ Win</Tog>
          <Tog active={ef.result === 'loss'} activeClass="bg-red-500/10 border-red-500/30 text-red-400"
            onClick={() => set('result', 'loss')}>✗ Loss</Tog>
          <Tog active={ef.result === 'breakeven'} activeClass="bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
            onClick={() => set('result', 'breakeven')}>{`= Breakeven`}</Tog>
        </div>
      </div>

      {/* Overtrade toggle */}
      <button
        type="button"
        onClick={() => set('is_overtrade', !ef.is_overtrade)}
        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all text-left
          ${ef.is_overtrade
            ? 'bg-orange-500/10 border-orange-500/40'
            : 'border-border/50 hover:bg-muted/40'}`}
      >
        <div>
          <p className={`text-sm font-bold ${ef.is_overtrade ? 'text-orange-400' : 'text-foreground/70'}`}>
            ⚠️ Overtrade
          </p>
          <p className="text-xs mt-0.5 text-muted-foreground">Equity berkurang, tidak masuk statistik trading</p>
        </div>
        <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${ef.is_overtrade ? 'bg-orange-500' : 'bg-border'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${ef.is_overtrade ? 'translate-x-5' : 'translate-x-0.5'}`}/>
        </div>
      </button>

      {/* P&L */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">P&L ({settings.currency})</Label>
        <CurrencyInput value={ef.pnl} onChange={v => set('pnl', v)} placeholder="150.000" />
        <p className="text-[10px] text-muted-foreground/60">Angka positif — tanda ± otomatis dari Result</p>
      </div>

      {/* Strategy */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Strategy</Label>
        <Select value={ef.strategy} onValueChange={v => set('strategy', v ?? '')}>
          <SelectTrigger><SelectValue placeholder="Select strategy" /></SelectTrigger>
          <SelectContent>
            {settings.strategies.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Followed Plan / Know Direction */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Ikut Plan?</Label>
          <div className="flex gap-2">
            <Tog active={ef.followed_plan === 'yes'} activeClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              onClick={() => set('followed_plan', ef.followed_plan === 'yes' ? '' : 'yes')}>
              <Check size={10}/> Ya
            </Tog>
            <Tog active={ef.followed_plan === 'no'} activeClass="bg-red-500/10 border-red-500/30 text-red-400"
              onClick={() => set('followed_plan', ef.followed_plan === 'no' ? '' : 'no')}>
              <X size={10}/> Tidak
            </Tog>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Tahu Arah?</Label>
          <div className="flex gap-2">
            <Tog active={ef.know_direction === 'yes'} activeClass="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              onClick={() => set('know_direction', ef.know_direction === 'yes' ? '' : 'yes')}>
              <Check size={10}/> Ya
            </Tog>
            <Tog active={ef.know_direction === 'no'} activeClass="bg-red-500/10 border-red-500/30 text-red-400"
              onClick={() => set('know_direction', ef.know_direction === 'no' ? '' : 'no')}>
              <X size={10}/> Tidak
            </Tog>
          </div>
        </div>
      </div>

      {/* Screenshot URL */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Screenshot URL</Label>
        <Input
          placeholder="https://www.tradingview.com/x/…"
          value={ef.screenshot_url}
          onChange={e => set('screenshot_url', e.target.value)}
        />
      </div>

      {/* Catatan */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60">Catatan</Label>
        <Textarea
          placeholder="Setup, entry reason, lessons…"
          value={ef.note}
          onChange={e => set('note', e.target.value)}
          rows={3}
        />
      </div>

      {/* Analisa by Claude */}
      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/60 flex items-center gap-1.5">
          <span className="text-purple-400">✦</span> Analisa by Claude
        </Label>
        <AutoTextarea
          value={ef.ai_analysis}
          onChange={v => set('ai_analysis', v)}
          placeholder="Paste analisa dari Claude di sini…"
        />
      </div>

      <Separator className="opacity-40"/>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Batal</Button>
        <Button className="flex-1" onClick={handleSave}>Simpan</Button>
      </div>
    </div>
  ) : null

  // ── View mode ─────────────────────────────────────────────────────────────
  const viewNode = !editing ? (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5 pt-1">
        <h2 className="text-2xl font-black tracking-tight">{t.pair}</h2>
        <Badge variant={t.direction === 'long' ? 'default' : 'destructive'} className="gap-1 text-xs font-bold">
          {t.direction === 'long' ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
          {t.direction.toUpperCase()}
        </Badge>
        <Badge
          variant={t.result === 'win' ? 'default' : t.result === 'loss' ? 'destructive' : 'secondary'}
          className="text-xs font-bold ml-auto"
        >
          {t.result === 'win' ? '✓ WIN' : t.result === 'loss' ? '✗ LOSS' : '= BE'}
        </Badge>
        {t.is_overtrade && (
          <span className="text-[10px] font-black bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-md px-2 py-0.5">
            ⚠️ OVERTRADE
          </span>
        )}
      </div>

      {/* P&L Hero */}
      <div className={`text-center py-6 rounded-2xl border ${heroBg}`}>
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-2.5">Profit & Loss</p>
        <p className={`text-5xl font-black tracking-tight leading-none ${resultColor}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
        </p>
      </div>

      {/* Direction analysis */}
      <DirectionCard market_structure={t.market_structure} direction={t.direction} />

      {/* Screenshot */}
      {t.screenshot_url && (
        <Screenshot url={t.screenshot_url} onExpand={() => setLightboxUrl(t.screenshot_url!)} />
      )}

      {/* Detail rows */}
      <div className="bg-muted/20 rounded-xl px-4 divide-y divide-border/25">
        <Row label="Tanggal" value={
          <span className="flex items-center gap-1.5 flex-wrap justify-end">
            <Calendar size={11} className="text-muted-foreground/50"/>
            {t.date}
            {t.entry_time && <><Clock size={11} className="text-muted-foreground/50 ml-0.5"/>{t.entry_time}</>}
          </span>
        }/>
        <Row label="Strategi" value={t.strategy ?? '—'}/>
        {t.market_structure && (
          <Row label="Market Structure" value={
            <span className={t.market_structure === 'bullish' ? 'text-emerald-400' : t.market_structure === 'bearish' ? 'text-red-400' : 'text-yellow-400'}>
              {t.market_structure === 'bullish' ? '🐂 Bullish' : t.market_structure === 'bearish' ? '🐻 Bearish' : '↔ Ranging'}
            </span>
          }/>
        )}
        <Row label="Ikut Plan" value={
          t.followed_plan === true  ? <span className="text-emerald-400 flex items-center gap-1 justify-end"><Check size={11}/> Ya</span>
          : t.followed_plan === false ? <span className="text-red-400 flex items-center gap-1 justify-end"><X size={11}/> Tidak</span>
          : '—'
        }/>
        <Row label="Tahu Arah" value={
          t.know_direction === true  ? <span className="text-emerald-400 flex items-center gap-1 justify-end"><Check size={11}/> Ya</span>
          : t.know_direction === false ? <span className="text-red-400 flex items-center gap-1 justify-end"><X size={11}/> Tidak</span>
          : '—'
        }/>
      </div>

      {/* Catatan */}
      {catatan && (
        <div className="rounded-xl bg-muted/25 border border-border/25 p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50 mb-2">Catatan</p>
          <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">{catatan}</p>
        </div>
      )}

      {/* Analisa by Claude */}
      {analisa && <AnalisaBlock text={analisa}/>}

      <Separator className="opacity-40"/>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5 font-semibold" onClick={() => setEditing(true)}>
          <Pencil size={12}/> Edit
        </Button>
        <Button variant="outline" size="sm" className="flex-1 font-semibold" onClick={onClose}>
          Tutup
        </Button>
        <Button variant="destructive" size="sm" className="px-3" onClick={() => { onDelete(t.id); onClose() }}>
          <Trash2 size={13}/>
        </Button>
      </div>
    </div>
  ) : null

  return (
    <>
      {editing ? editNode : viewNode}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

type Props = {
  trade: Trade | null
  open: boolean
  onClose: () => void
  onDelete: (id: string) => void
  fmt: (n: number) => string
}

export function TradeDetailDialog({ trade, open, onClose, onDelete, fmt }: Props) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{trade?.pair ?? 'Trade Detail'}</DialogTitle>
        </DialogHeader>
        {trade && <Inner t={trade} onClose={onClose} onDelete={onDelete} fmt={fmt} />}
      </DialogContent>
    </Dialog>
  )
}
