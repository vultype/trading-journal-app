'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'

const MOODS: { value: 1|2|3|4|5; label: string; emoji: string; color: string }[] = [
  { value: 1, label: 'Buruk',   emoji: '😞', color: 'border-red-400 bg-red-50 text-red-600' },
  { value: 2, label: 'Kurang', emoji: '😕', color: 'border-orange-400 bg-orange-50 text-orange-600' },
  { value: 3, label: 'Cukup',  emoji: '😐', color: 'border-yellow-400 bg-yellow-50 text-yellow-600' },
  { value: 4, label: 'Baik',   emoji: '😊', color: 'border-blue-400 bg-blue-50 text-blue-600' },
  { value: 5, label: 'Luar biasa', emoji: '🔥', color: 'border-emerald-400 bg-emerald-50 text-emerald-600' },
]

const PROMPTS = [
  'Apa yang berjalan baik hari ini?',
  'Apakah kamu mengikuti trading plan?',
  'Emosi apa yang muncul selama trading?',
  'Apa yang bisa diperbaiki besok?',
  'Setup terbaik yang kamu lihat hari ini?',
]

function formatDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function displayDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function JournalPage() {
  const { journalNotes, saveJournal, trades } = useStore()
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()))
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<1|2|3|4|5>(3)
  const [saved, setSaved] = useState(false)

  const existing = journalNotes.find(n => n.date === selectedDate)

  function goDay(offset: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + offset)
    const next = formatDate(d)
    setSelectedDate(next)
    const note = journalNotes.find(n => n.date === next)
    setContent(note?.content ?? '')
    setMood(note?.mood ?? 3)
    setSaved(false)
  }

  function loadDate(date: string) {
    setSelectedDate(date)
    const note = journalNotes.find(n => n.date === date)
    setContent(note?.content ?? '')
    setMood(note?.mood ?? 3)
    setSaved(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    saveJournal({ date: selectedDate, content: content.trim(), mood })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tradesToday = trades.filter(t => t.date === selectedDate)
  const pnlToday = tradesToday.reduce((s, t) => s + t.pnl, 0)

  const recentJournals = [...journalNotes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold">Jurnal Harian</h1>
        <p className="text-sm text-muted-foreground">Refleksi trading dan psikologi per hari</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="md:col-span-2 space-y-4">
          {/* Date Nav */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goDay(-1)}>
              <ChevronLeft size={14} />
            </Button>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => loadDate(e.target.value)}
              className="w-44 h-8 text-sm"
            />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goDay(1)} disabled={selectedDate >= formatDate(new Date())}>
              <ChevronRight size={14} />
            </Button>
            <span className="text-xs text-muted-foreground ml-1">{displayDate(selectedDate)}</span>
          </div>

          {/* Trade summary for selected day */}
          {tradesToday.length > 0 && (
            <div className="rounded-lg bg-muted p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">{tradesToday.length} trade hari ini</span>
              <span className={`font-bold ${pnlToday >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {pnlToday >= 0 ? '+' : ''}${pnlToday.toFixed(2)}
              </span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Mood */}
            <div>
              <Label className="text-xs mb-2 block">Mood Hari Ini</Label>
              <div className="flex gap-2">
                {MOODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={`flex-1 flex flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-medium transition-all ${mood === m.value ? m.color : 'border-muted bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                  >
                    <span className="text-lg">{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompts */}
            <div>
              <Label className="text-xs mb-2 block">Pertanyaan refleksi</Label>
              <div className="flex flex-wrap gap-1.5">
                {PROMPTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setContent(c => c + (c ? '\n\n' : '') + p + '\n')}
                    className="text-xs px-2 py-1 rounded-full border bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    + {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div>
              <Label className="text-xs mb-2 block">Catatan</Label>
              <Textarea
                placeholder="Tulis refleksi kamu di sini…"
                value={content}
                onChange={e => { setContent(e.target.value); setSaved(false) }}
                rows={10}
                className="resize-none font-mono text-sm leading-relaxed"
              />
            </div>

            <Button type="submit" className="w-full" disabled={!content.trim()}>
              {saved ? '✓ Tersimpan!' : existing ? 'Update Jurnal' : 'Simpan Jurnal'}
            </Button>
          </form>
        </div>

        {/* Sidebar: Recent */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Jurnal Sebelumnya</p>
          {recentJournals.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <BookOpen size={20} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Belum ada jurnal</p>
              </CardContent>
            </Card>
          ) : recentJournals.map(n => {
            const m = MOODS.find(x => x.value === n.mood)
            return (
              <button
                key={n.id}
                onClick={() => loadDate(n.date)}
                className={`w-full text-left rounded-lg border p-3 text-sm transition-colors hover:bg-muted ${selectedDate === n.date ? 'border-primary bg-muted' : 'bg-card'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-xs">{n.date}</span>
                  <span className="text-base">{m?.emoji}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
