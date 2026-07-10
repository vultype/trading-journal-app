'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen, ChevronLeft, ChevronRight, Trash2, Flame, TrendingUp, TrendingDown,
  CalendarDays, Sparkles,
} from 'lucide-react'

const MOODS: { value: 1|2|3|4|5; label: string; emoji: string; active: string }[] = [
  { value: 1, label: 'Buruk',      emoji: '😞', active: 'border-red-500/50 bg-red-500/15 text-red-400' },
  { value: 2, label: 'Kurang',     emoji: '😕', active: 'border-orange-500/50 bg-orange-500/15 text-orange-400' },
  { value: 3, label: 'Cukup',      emoji: '😐', active: 'border-yellow-500/50 bg-yellow-500/15 text-yellow-400' },
  { value: 4, label: 'Baik',       emoji: '😊', active: 'border-blue-500/50 bg-blue-500/15 text-blue-400' },
  { value: 5, label: 'Luar biasa', emoji: '🔥', active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400' },
]

const PROMPTS = [
  'Apa yang berjalan baik hari ini?',
  'Apakah mengikuti trading plan?',
  'Emosi yang muncul saat trading?',
  'Apa yang bisa diperbaiki besok?',
  'Setup terbaik hari ini?',
]

const fmtDate = (d: Date) => d.toISOString().split('T')[0]
const displayDate = (s: string) =>
  new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

export default function JournalPage() {
  const { journalNotes, saveJournal, deleteJournal, trades } = useStore()
  const fmt = useCurrency()
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<1|2|3|4|5>(3)
  const [saved, setSaved] = useState(false)

  const existing = journalNotes.find(n => n.date === selectedDate)

  function loadDate(date: string) {
    setSelectedDate(date)
    const note = journalNotes.find(n => n.date === date)
    setContent(note?.content ?? '')
    setMood(note?.mood ?? 3)
    setSaved(false)
  }
  function goDay(offset: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    loadDate(fmtDate(d))
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    saveJournal({ date: selectedDate, content: content.trim(), mood })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  function handleDelete() {
    deleteJournal(selectedDate)
    setContent(''); setMood(3); setSaved(false)
  }

  const tradesToday = trades.filter(t => t.date === selectedDate).sort((a, b) => (a.entry_time ?? '').localeCompare(b.entry_time ?? ''))
  const pnlToday = tradesToday.reduce((s, t) => s + t.pnl, 0)

  const recentJournals = [...journalNotes].sort((a, b) => b.date.localeCompare(a.date))

  // Journaling streak (consecutive days up to today that have a journal)
  const journalDates = new Set(journalNotes.map(n => n.date))
  let streak = 0
  { const d = new Date(); while (journalDates.has(fmtDate(d))) { streak++; d.setDate(d.getDate() - 1) } }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Jurnal Harian</h1>
          <p className="text-sm text-muted-foreground">Refleksi trading dan psikologi per hari</p>
        </div>
        <div className="flex gap-2">
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/5 px-3.5 py-2 text-center">
            <p className="text-lg font-black text-orange-400 flex items-center gap-1 justify-center"><Flame size={14}/> {streak}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Hari beruntun</p>
          </div>
          <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 px-3.5 py-2 text-center">
            <p className="text-lg font-black text-indigo-400 flex items-center gap-1 justify-center"><BookOpen size={14}/> {journalNotes.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total jurnal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="md:col-span-2 space-y-4">
          {/* Date nav */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goDay(-1)}><ChevronLeft size={14} /></Button>
            <Input type="date" value={selectedDate} onChange={e => loadDate(e.target.value)} className="w-40 h-8 text-sm" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goDay(1)} disabled={selectedDate >= fmtDate(new Date())}><ChevronRight size={14} /></Button>
            <span className="text-xs text-muted-foreground ml-1 flex items-center gap-1"><CalendarDays size={12}/> {displayDate(selectedDate)}</span>
          </div>

          {/* Linked trades of the day */}
          {tradesToday.length > 0 && (
            <Card className={pnlToday >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'}>
              <CardContent className="pt-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground/60">{tradesToday.length} Trade Hari Ini</p>
                  <span className={`font-black ${pnlToday >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{pnlToday >= 0 ? '+' : ''}{fmt(pnlToday)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tradesToday.map(t => (
                    <span key={t.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg border font-medium ${t.pnl >= 0 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' : 'border-red-500/30 text-red-400 bg-red-500/5'}`}>
                      {t.direction === 'long' ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                      {t.pair} {t.entry_time ? `· ${t.entry_time}` : ''} · {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Mood */}
            <div>
              <Label className="text-xs mb-2 block text-muted-foreground">Mood Hari Ini</Label>
              <div className="flex gap-2">
                {MOODS.map(m => (
                  <button key={m.value} type="button" onClick={() => { setMood(m.value); setSaved(false) }}
                    className={`flex-1 flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-medium transition-all ${mood === m.value ? m.active : 'border-border/40 text-muted-foreground/60 hover:bg-muted/40'}`}>
                    <span className="text-xl">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompts */}
            <div>
              <Label className="text-xs mb-2 block text-muted-foreground flex items-center gap-1"><Sparkles size={11} className="text-primary"/> Pemantik refleksi</Label>
              <div className="flex flex-wrap gap-1.5">
                {PROMPTS.map(p => (
                  <button key={p} type="button" onClick={() => { setContent(c => c + (c ? '\n\n' : '') + p + '\n'); setSaved(false) }}
                    className="text-xs px-2.5 py-1 rounded-full border border-border/50 bg-muted/40 hover:bg-muted text-muted-foreground transition-colors">
                    + {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <Label className="text-xs mb-2 block text-muted-foreground">Catatan</Label>
              <Textarea placeholder="Tulis refleksi kamu di sini…" value={content}
                onChange={e => { setContent(e.target.value); setSaved(false) }}
                rows={10} className="resize-none text-sm leading-relaxed" />
            </div>

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!content.trim()}>
                {saved ? '✓ Tersimpan!' : existing ? 'Update Jurnal' : 'Simpan Jurnal'}
              </Button>
              {existing && (
                <Button type="button" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                  <Trash2 size={13} /> Hapus
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Sidebar: recent journals */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jurnal Sebelumnya</p>
          {recentJournals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <BookOpen size={20} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Belum ada jurnal</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
              {recentJournals.map(n => {
                const m = MOODS.find(x => x.value === n.mood)
                const dayPnl = trades.filter(t => t.date === n.date).reduce((s, t) => s + t.pnl, 0)
                const hasTrades = trades.some(t => t.date === n.date)
                return (
                  <button key={n.id} onClick={() => loadDate(n.date)}
                    className={`w-full text-left rounded-xl border p-3 text-sm transition-colors hover:bg-muted/50 ${selectedDate === n.date ? 'border-primary bg-muted/40' : 'border-border/40 bg-card'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs">{n.date}</span>
                      <span className="text-base">{m?.emoji}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{n.content}</p>
                    {hasTrades && (
                      <Badge variant="outline" className={`mt-2 text-[9px] ${dayPnl >= 0 ? 'text-emerald-400 border-emerald-500/25' : 'text-red-400 border-red-500/25'}`}>
                        {dayPnl >= 0 ? '+' : ''}{fmt(dayPnl)}
                      </Badge>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
