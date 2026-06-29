'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  TrendingUp, TrendingDown, ExternalLink, Trash2, Check, X, Clock, Calendar,
  ImageOff, Loader2,
} from 'lucide-react'
import type { Trade } from '@/types'

type Props = {
  trade: Trade | null
  open: boolean
  onClose: () => void
  onDelete: (id: string) => void
  fmt: (n: number) => string
}

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right ${className ?? ''}`}>{value}</span>
    </div>
  )
}

function ImagePreview({ url }: { url: string }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  return (
    <div className="rounded-xl overflow-hidden border border-border/50">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border/40 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Screenshot Chart</span>
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          Buka <ExternalLink size={9}/>
        </a>
      </div>

      {status === 'error' ? (
        /* Fallback: image could not load (e.g. TV snapshot page URL) */
        <div className="py-6 flex flex-col items-center gap-3 bg-muted/20">
          <ImageOff size={28} className="text-muted-foreground/40"/>
          <p className="text-xs text-muted-foreground">Gambar tidak bisa ditampilkan secara langsung.</p>
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
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

export function TradeDetailDialog({ trade: t, open, onClose, onDelete, fmt }: Props) {
  if (!t) return null

  const resultColor = t.result === 'win' ? 'text-emerald-400' : t.result === 'loss' ? 'text-red-400' : 'text-yellow-400'

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

        {/* P&L header */}
        <div className={`text-center py-4 rounded-xl ${t.pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <p className="text-xs text-muted-foreground mb-1">P&L</p>
          <p className={`text-4xl font-black ${resultColor}`}>
            {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
          </p>
        </div>

        {/* Screenshot — embedded image */}
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

        {/* Notes */}
        {t.note && (
          <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Catatan</p>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{t.note}</p>
          </div>
        )}

        <Separator/>

        {/* Actions */}
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
