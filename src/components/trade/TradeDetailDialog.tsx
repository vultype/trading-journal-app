'use client'

import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp, TrendingDown, ExternalLink, Trash2, Check, X, Clock, Calendar,
  ImageOff, Loader2, AlertTriangle, ChevronDown, ArrowLeftRight,
} from 'lucide-react'
import type { Trade } from '@/types'

type Props = {
  trade: Trade | null
  open: boolean
  onClose: () => void
  onDelete: (id: string) => void
  fmt: (n: number) => string
}

// ── Lightweight markdown renderer for Claude output ──────────────────────────
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*'))   return <em key={i} className="italic">{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`'))   return <code key={i} className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (listItems.length === 0) return
    elements.push(
      <ul key={`ul-${elements.length}`} className="space-y-1 ml-1">
        {listItems.map((item, i) => (
          <li key={i} className="flex gap-2 items-start">
            <span className="text-purple-400 mt-0.5 shrink-0">•</span>
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()

    // Blank line
    if (!trimmed) {
      flushList()
      elements.push(<div key={`br-${i}`} className="h-1" />)
      return
    }

    // Heading
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(<p key={i} className="text-xs font-bold text-foreground uppercase tracking-wider mt-2">{trimmed.slice(4)}</p>)
      return
    }
    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(<p key={i} className="text-sm font-bold text-foreground mt-2">{trimmed.slice(3)}</p>)
      return
    }
    if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(<p key={i} className="text-sm font-bold text-foreground mt-2">{trimmed.slice(2)}</p>)
      return
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^(?:[-•*]|\d+\.)\s+(.+)/)
    if (bulletMatch) {
      listItems.push(bulletMatch[1])
      return
    }

    // Normal paragraph
    flushList()
    elements.push(<p key={i} className="leading-relaxed">{renderInline(trimmed)}</p>)
  })

  flushList()
  return <div className="space-y-1.5 text-sm text-foreground/90">{elements}</div>
}

// ── Direction vs Market Structure analysis ────────────────────────────────────
function DirectionAnalysis({ market_structure, direction }: {
  market_structure?: 'bullish' | 'bearish' | 'ranging'
  direction: 'long' | 'short'
}) {
  if (!market_structure) return null

  if (market_structure === 'ranging') {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2.5">
        <ArrowLeftRight size={13} className="text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-yellow-400">Market Ranging / Sideways</p>
          <p className="text-xs text-muted-foreground mt-0.5">Tidak ada tren dominan — waspadai false breakout di kedua arah</p>
        </div>
      </div>
    )
  }

  const isBullish = market_structure === 'bullish'
  const isLong    = direction === 'long'
  const searah    = (isBullish && isLong) || (!isBullish && !isLong)

  if (searah) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
        <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-emerald-400">Entry Searah Market Structure</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isBullish ? '🐂 Bullish' : '🐻 Bearish'} structure + {isLong ? 'Long' : 'Short'} — mengikuti arah tren utama
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5">
      <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-semibold text-red-400">⚠️ Entry Berlawanan Arah!</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isBullish ? '🐂 Bullish' : '🐻 Bearish'} structure + {isLong ? 'Long' : 'Short'} — counter-trend, risiko lebih tinggi dari biasanya
        </p>
      </div>
    </div>
  )
}

// ── Collapsible Analisa by Claude ─────────────────────────────────────────────
function AnalisaBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false)

  // Preview: first non-empty line stripped of markdown symbols
  const preview = text
    .split('\n')
    .map(l => l.replace(/^#+\s*/, '').replace(/\*\*/g, '').replace(/\*/g, '').trim())
    .find(l => l.length > 0) ?? ''

  return (
    <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-purple-500/5 transition-colors text-left"
      >
        <span className="text-[10px] text-purple-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
          <span>✦</span> Analisa by Claude
        </span>
        <ChevronDown
          size={13}
          className={`text-purple-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsed preview */}
      {!open && (
        <p className="px-3 pb-3 text-xs text-muted-foreground line-clamp-2 border-t border-purple-500/10">
          {preview}…
        </p>
      )}

      {/* Expanded content */}
      {open && (
        <div className="px-3 pb-3 border-t border-purple-500/10 pt-2.5">
          <MarkdownText text={text} />
        </div>
      )}
    </div>
  )
}

// ── Row helper ────────────────────────────────────────────────────────────────
function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${className ?? ''}`}>{value}</span>
    </div>
  )
}

// ── Image preview ─────────────────────────────────────────────────────────────
function ImagePreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Screenshot Chart</span>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline flex items-center gap-1">
          Buka <ExternalLink size={9}/>
        </a>
      </div>
      {status === 'error' ? (
        <div className="py-6 flex flex-col items-center gap-3 bg-muted/20">
          <ImageOff size={28} className="text-muted-foreground/40"/>
          <p className="text-xs text-muted-foreground">Gambar tidak bisa ditampilkan secara langsung.</p>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <ExternalLink size={12}/> Buka di TradingView
          </a>
        </div>
      ) : (
        <div className="relative bg-muted/20">
          {status === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center min-h-[80px]">
              <Loader2 size={20} className="animate-spin text-muted-foreground"/>
            </div>
          )}
          <img
            src={url}
            alt="Trade chart screenshot"
            className={`w-full max-h-72 object-contain transition-opacity duration-300 ${status === 'ok' ? 'opacity-100' : 'opacity-0'}`}
            loading="lazy"
            onLoad={() => setStatus('ok')}
            onError={() => setStatus('error')}
          />
        </div>
      )}
    </div>
  )
}

// ── Main dialog ───────────────────────────────────────────────────────────────
export function TradeDetailDialog({ trade: t, open, onClose, onDelete, fmt }: Props) {
  if (!t) return null

  const resultColor = t.result === 'win' ? 'text-emerald-400' : t.result === 'loss' ? 'text-red-400' : 'text-yellow-400'

  // Parse note: split catatan vs analisa
  const SEPARATOR = '--- Analisa by Claude ---'
  const sepIdx   = t.note?.indexOf(SEPARATOR) ?? -1
  const catatan  = sepIdx !== -1 ? t.note!.slice(0, sepIdx).trim() : (t.note ?? '')
  const analisa  = sepIdx !== -1 ? t.note!.slice(sepIdx + SEPARATOR.length).trim() : ''

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{t.pair}</span>
            <Badge variant={t.direction === 'long' ? 'default' : 'destructive'} className="gap-1 text-xs">
              {t.direction === 'long' ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
              {t.direction.toUpperCase()}
            </Badge>
            <Badge
              variant={t.result === 'win' ? 'default' : t.result === 'loss' ? 'destructive' : 'secondary'}
              className="text-xs ml-auto"
            >
              {t.result.toUpperCase()}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* P&L */}
        <div className={`text-center py-4 rounded-xl ${t.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <p className="text-xs text-muted-foreground mb-1">P&L</p>
          <p className={`text-4xl font-black ${resultColor}`}>
            {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
          </p>
        </div>

        {/* Direction vs Market Structure */}
        <DirectionAnalysis market_structure={t.market_structure} direction={t.direction} />

        {/* Screenshot */}
        {t.screenshot_url && <ImagePreview url={t.screenshot_url}/>}

        {/* Detail rows */}
        <div className="mt-1">
          <Row label="Tanggal" value={
            <span className="flex items-center gap-1.5 flex-wrap justify-end">
              <Calendar size={12} className="text-muted-foreground"/>
              {t.date}
              {t.entry_time && <><Clock size={12} className="text-muted-foreground ml-1"/>{t.entry_time}</>}
            </span>
          }/>
          <Row label="Strategi" value={t.strategy ?? '—'}/>
          {t.market_structure && (
            <Row label="Market Structure" value={
              <span className={
                t.market_structure === 'bullish' ? 'text-emerald-400 font-semibold'
                : t.market_structure === 'bearish' ? 'text-red-400 font-semibold'
                : 'text-yellow-400 font-semibold'
              }>
                {t.market_structure === 'bullish' ? '🐂 Bullish'
                  : t.market_structure === 'bearish' ? '🐻 Bearish'
                  : '↔ Ranging'}
              </span>
            }/>
          )}
          <Row label="Ikut Trading Plan" value={
            t.followed_plan === true  ? <span className="text-emerald-400 flex items-center gap-1 justify-end"><Check size={12}/> Ya</span>
            : t.followed_plan === false ? <span className="text-red-400 flex items-center gap-1 justify-end"><X size={12}/> Tidak</span>
            : '—'
          }/>
          <Row label="Tahu Arah Pasar" value={
            t.know_direction === true  ? <span className="text-emerald-400 flex items-center gap-1 justify-end"><Check size={12}/> Ya</span>
            : t.know_direction === false ? <span className="text-red-400 flex items-center gap-1 justify-end"><X size={12}/> Tidak</span>
            : '—'
          }/>
        </div>

        {/* Catatan */}
        {catatan && (
          <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-semibold">Catatan</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{catatan}</p>
          </div>
        )}

        {/* Analisa by Claude — collapsible + markdown */}
        {analisa && <AnalisaBlock text={analisa} />}

        <Separator/>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Tutup</Button>
          <Button variant="destructive" size="icon" onClick={() => { onDelete(t.id); onClose() }}>
            <Trash2 size={14}/>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
