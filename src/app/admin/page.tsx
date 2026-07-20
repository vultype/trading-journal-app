'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useSubscription } from '@/hooks/useSubscription'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { toast } from '@/lib/toast'
import { Confetti } from '@/components/ui/Confetti'
import { playRegimeChime } from '@/lib/chime'
import { Shield, Users, TrendingUp, Activity, Loader2, AlertTriangle, RefreshCw, ImageIcon, Upload, Trash2, Info, Receipt, CheckCircle2, XCircle, ExternalLink, Clock, ArrowLeft, LogOut, Crown, Wallet, Search, Megaphone, Globe, Plus, Pencil, Eye, EyeOff, CalendarDays, Newspaper, Wrench, PartyPopper, Bell, Mail } from 'lucide-react'
import { rp, planName, type PlanId } from '@/lib/pricing'
import { TEMPLATES, type TemplateId } from '@/lib/email-templates'
import type { Trade, Transfer } from '@/types'

const fmt = (n: number) => rp(n)
const fmtDate = (d: Date | null) => d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
// Login terakhir: relatif ("3j lalu") kalau baru, tanggal biasa kalau lama — lebih cepat dibaca admin.
const fmtLoginRel = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(iso), diffMin = Math.floor((Date.now() - d.getTime()) / 60_000)
  if (diffMin < 1) return 'baru saja'
  if (diffMin < 60) return `${diffMin}m lalu`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}j lalu`
  if (diffMin < 43200) return `${Math.floor(diffMin / 1440)}h lalu`
  return fmtDate(d)
}
function addMonths(d: Date, m: number) { const x = new Date(d); x.setMonth(x.getMonth() + m); return x }

function LogoManager() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('logo_url').eq('id', 1).maybeSingle()
      .then(({ data }) => setLogoUrl((data?.logo_url as string | null) ?? null))
  }, [])

  async function updateLogo(url: string | null) {
    setLogoUrl(url)
    const { error } = await createClient().from('app_config')
      .upsert({ id: 1, logo_url: url, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) toast.error('Gagal menyimpan: ' + error.message)
  }

  async function handleUpload(file: File) {
    if (!file) return
    if (file.size > 1_000_000) { toast.error('Ukuran file maksimal 1 MB'); return }
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop() || 'png'
      const path = `branding/logo-${Date.now()}.${ext}`
      const { error } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
      if (error) { toast.error('Upload gagal: ' + error.message); setUploading(false); return }
      const { data } = sb.storage.from('trade-screenshots').getPublicUrl(path)
      await updateLogo(data.publicUrl)
      toast.success('Logo berhasil diperbarui')
    } catch {
      toast.error('Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ImageIcon size={15} className="text-primary" /> Logo Aplikasi (Branding)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center justify-center min-w-[180px] h-20 rounded-xl border border-border/50 bg-muted/30 px-4">
            {logoUrl ? <BrandLogo url={logoUrl} size="lg" /> : <span className="text-sm text-muted-foreground">Belum ada logo</span>}
          </div>
          <div className="flex gap-2">
            <label className={`inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity ${uploading ? 'opacity-60 pointer-events-none' : 'hover:opacity-90'}`}>
              {uploading ? <><Loader2 size={15} className="animate-spin" /> Mengupload…</> : <><Upload size={15} /> Upload Logo</>}
              <input type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </label>
            {logoUrl && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => { updateLogo(null); toast.success('Logo dihapus') }}>
                <Trash2 size={14} /> Hapus
              </Button>
            )}
          </div>
        </div>

        {/* Panduan ukuran */}
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Panduan Ukuran Logo</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
            <li><strong>Format:</strong> PNG (background transparan), SVG, atau WebP.</li>
            <li><strong>Rasio:</strong> horizontal / landscape, sekitar <strong>4:1</strong> (mis. 320×80 px).</li>
            <li><strong>Ukuran ideal:</strong> lebar 240–480 px, tinggi 60–120 px.</li>
            <li><strong>File maksimal:</strong> 1 MB.</li>
            <li>Gunakan warna terang / kontras agar terbaca di sidebar gelap.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Gambar samping halaman Login/Register ──
function LoginImageManager() {
  const [url, setUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('login_image_url').eq('id', 1).maybeSingle()
      .then(({ data }) => setUrl((data?.login_image_url as string | null) ?? null))
  }, [])

  async function save(next: string | null) {
    setUrl(next)
    const { error } = await createClient().from('app_config')
      .upsert({ id: 1, login_image_url: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) toast.error('Gagal menyimpan: ' + error.message)
  }

  async function handleUpload(file: File) {
    if (!file) return
    if (file.size > 3_000_000) { toast.error('Ukuran file maksimal 3 MB'); return }
    setUploading(true)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `branding/login-${Date.now()}.${ext}`
      const { error } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
      if (error) { toast.error('Upload gagal: ' + error.message); setUploading(false); return }
      const { data } = sb.storage.from('trade-screenshots').getPublicUrl(path)
      await save(data.publicUrl)
      toast.success('Gambar login berhasil diperbarui')
    } catch {
      toast.error('Upload gagal')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ImageIcon size={15} className="text-primary" /> Gambar Halaman Login</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="flex items-center justify-center w-40 h-52 rounded-xl border border-border/50 bg-muted/30 overflow-hidden shrink-0">
            {url ? <img src={url} alt="Login" className="w-full h-full object-cover" /> : <span className="text-xs text-muted-foreground text-center px-3">Belum ada gambar<br/>(pakai gradien default)</span>}
          </div>
          <div className="flex flex-col gap-2">
            <label className={`inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity ${uploading ? 'opacity-60 pointer-events-none' : 'hover:opacity-90'}`}>
              {uploading ? <><Loader2 size={15} className="animate-spin" /> Mengupload…</> : <><Upload size={15} /> Upload Gambar</>}
              <input type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
            </label>
            {url && (
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => { save(null); toast.success('Gambar login dihapus') }}>
                <Trash2 size={14} /> Hapus
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Panduan Ukuran</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
            <li><strong>Rasio:</strong> vertikal / portrait (mis. 800×1000 px). Ditampilkan di sisi kiri form login.</li>
            <li><strong>Format:</strong> JPG / PNG / WebP. Gambar gelap/berwarna cocok dengan tema.</li>
            <li><strong>File maksimal:</strong> 3 MB. Kosongkan untuk pakai gradien default.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Gambar fitur homepage (section "Satu Terminal. Semua yang Institusi Punya.") ──
// Disimpan di app_config.feature_images (jsonb: { key: url }), upload ke bucket yang sama.
const FEATURE_SLOTS: { key: string; label: string }[] = [
  { key: 'gauge', label: 'Bias Harian Jelas' },
  { key: 'decision', label: 'Keputusan AI' },
  { key: 'macro', label: 'Makro Real-Time' },
  { key: 'sentiment', label: 'Posisi Institusi' },
  { key: 'chat', label: 'Tanya AI' },
  { key: 'notif', label: 'Alert Telegram' },
  // Section showcase "Bukan janji. Ini isi terminalnya." (screenshot asli terminal)
  { key: 'ss_signal', label: 'Showcase — Signal Meter' },
  { key: 'ss_ai', label: 'Showcase — Analisa AI' },
  { key: 'ss_pillar', label: 'Showcase — 3 Pilar' },
  { key: 'ss_macro', label: 'Showcase — Makro' },
  { key: 'ss_sentiment', label: 'Showcase — Sentimen/COT' },
  { key: 'ss_confluence', label: 'Showcase — Multi-Timeframe' },
]
function FeatureImagesManager() {
  const [images, setImages] = useState<Record<string, string>>({})
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [needsMigration, setNeedsMigration] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('feature_images').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setNeedsMigration(true); return }
        const fi = data?.feature_images; if (fi && typeof fi === 'object') setImages(fi as Record<string, string>)
      })
  }, [])

  async function save(next: Record<string, string>) {
    setImages(next)
    const { error } = await createClient().from('app_config')
      .upsert({ id: 1, feature_images: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) { setNeedsMigration(true); toast.error('Gagal menyimpan: ' + error.message) }
  }

  async function handleUpload(key: string, file: File) {
    if (file.size > 1_500_000) { toast.error('Ukuran file maksimal 1,5 MB'); return }
    setBusyKey(key)
    try {
      const sb = createClient()
      const ext = file.name.split('.').pop() || 'png'
      const path = `landing/feature-${key}-${Date.now()}.${ext}`
      const { error } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
      if (error) { toast.error('Upload gagal: ' + error.message); return }
      const { data } = sb.storage.from('trade-screenshots').getPublicUrl(path)
      await save({ ...images, [key]: data.publicUrl })
      toast.success(`Gambar "${FEATURE_SLOTS.find(s => s.key === key)?.label}" tersimpan`)
    } catch { toast.error('Upload gagal') } finally { setBusyKey(null) }
  }

  function remove(key: string) {
    const next = { ...images }; delete next[key]
    save(next); toast.success('Gambar dihapus')
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ImageIcon size={15} className="text-primary" /> Gambar Fitur Homepage (Showcase)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {needsMigration && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-bold text-amber-500 mb-1.5">⚠ Kolom database belum ada — upload belum bisa disimpan</p>
            <p className="text-muted-foreground mb-2">Jalankan SQL ini sekali di <strong>Supabase → SQL Editor</strong>, lalu refresh halaman:</p>
            <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-xs text-emerald-300 overflow-x-auto whitespace-pre">alter table app_config add column if not exists feature_images jsonb not null default $${'{'}{'}'}$$::jsonb;</code>
            <p className="text-[11px] text-muted-foreground mt-2">Jika sebelumnya error saat menjalankan SQL: kemungkinan tanda kutip berubah jadi kutip miring (‘ ’) saat disalin. Ketik ulang manual atau salin persis dari kotak di atas.</p>
          </div>
        )}
        {/* Hero image — dashboard besar di homepage */}
        <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold flex items-center gap-1.5"><ImageIcon size={14} className="text-primary" /> Gambar Hero (Dashboard Besar Homepage)</p>
            {images['hero'] && (
              <button onClick={() => remove('hero')} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"><Trash2 size={12} /> Hapus</button>
            )}
          </div>
          <div className="flex items-center justify-center rounded-lg border border-border/40 bg-black/20 overflow-hidden mb-2 aspect-[16/10] max-w-md mx-auto">
            {images['hero']
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={images['hero']} alt="Hero" className="w-full h-full object-cover" />
              : <span className="text-[11px] text-muted-foreground">Belum ada — pakai chart animasi bawaan</span>}
          </div>
          <label className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity ${busyKey === 'hero' ? 'opacity-60 pointer-events-none' : 'hover:opacity-90'}`}>
            {busyKey === 'hero' ? <><Loader2 size={13} className="animate-spin" /> Upload…</> : <><Upload size={13} /> Upload Gambar Hero</>}
            <input type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload('hero', f) }} />
          </label>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">Screenshot dashboard terminal (landscape). <strong>Ukuran ideal 2400 × 1500 px</strong> (rasio 16:10), format WebP/PNG, maks 1,5 MB. Ditampilkan penuh dengan bar browser di atasnya.</p>
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 pt-2">Gambar per fitur (showcase)</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURE_SLOTS.map(s => (
            <div key={s.key} className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-xs font-bold mb-2">{s.label}</p>
              <div className="flex items-center justify-center h-24 rounded-lg border border-border/40 bg-black/20 overflow-hidden mb-2">
                {images[s.key]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={images[s.key]} alt={s.label} className="w-full h-full object-cover" />
                  : <span className="text-[11px] text-muted-foreground">Belum ada — pakai dummy</span>}
              </div>
              <div className="flex gap-1.5">
                <label className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/15 text-primary px-2 py-1.5 text-xs font-semibold cursor-pointer transition-opacity ${busyKey === s.key ? 'opacity-60 pointer-events-none' : 'hover:bg-primary/25'}`}>
                  {busyKey === s.key ? <><Loader2 size={12} className="animate-spin" /> Upload…</> : <><Upload size={12} /> Upload</>}
                  <input type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(s.key, f) }} />
                </label>
                {images[s.key] && (
                  <button onClick={() => remove(s.key)} className="inline-flex items-center justify-center rounded-lg border border-border/50 px-2 text-destructive hover:bg-destructive/10 transition-colors"><Trash2 size={13} /></button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Panduan Ukuran Gambar</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
            <li><strong>Ukuran ideal: 1280 × 800 px</strong> (rasio landscape 16:10) — screenshot area dashboard terminal.</li>
            <li><strong>Format:</strong> PNG atau WebP (disarankan WebP agar ringan).</li>
            <li><strong>File maksimal:</strong> 1,5 MB per gambar.</li>
            <li>Panel showcase mengikuti rasio 16:10 dan gambar ditampilkan <strong>penuh mengisi frame</strong> (crop-to-fill) — pakai rasio 16:10 persis agar tidak terpotong, dan letakkan bagian penting dashboard di tengah gambar.</li>
            <li>Slot yang kosong otomatis memakai ilustrasi dummy bawaan.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Logo broker/partner untuk slider homepage (app_config.client_logos: jsonb array url) ──
function ClientLogosManager() {
  const [logos, setLogos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('client_logos').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setNeedsMigration(true); return }
        const cl = data?.client_logos; if (Array.isArray(cl)) setLogos(cl.filter((x): x is string => typeof x === 'string'))
      })
  }, [])

  async function save(next: string[]) {
    setLogos(next)
    const { error } = await createClient().from('app_config')
      .upsert({ id: 1, client_logos: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) { setNeedsMigration(true); toast.error('Gagal menyimpan: ' + error.message) }
  }

  async function handleUpload(files: FileList) {
    setUploading(true)
    try {
      const sb = createClient()
      const urls: string[] = []
      for (const file of Array.from(files)) {
        if (file.size > 500_000) { toast.error(`"${file.name}" > 500 KB, dilewati`); continue }
        const ext = file.name.split('.').pop() || 'png'
        const path = `landing/broker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
        if (error) { toast.error('Upload gagal: ' + error.message); continue }
        urls.push(sb.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl)
      }
      if (urls.length) { await save([...logos, ...urls]); toast.success(`${urls.length} logo ditambahkan`) }
    } catch { toast.error('Upload gagal') } finally { setUploading(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ImageIcon size={15} className="text-primary" /> Logo Broker/Partner (Slider Homepage)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {needsMigration && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-bold text-amber-500 mb-1.5">⚠ Kolom database belum ada — jalankan SQL ini di Supabase → SQL Editor, lalu refresh:</p>
            <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-xs text-emerald-300 overflow-x-auto whitespace-pre">alter table app_config add column if not exists client_logos jsonb not null default $$[]$$::jsonb;</code>
            <p className="text-[11px] text-muted-foreground mt-2">Jika sebelumnya error saat menjalankan SQL: kemungkinan tanda kutip (') berubah jadi kutip miring (‘ ’) saat disalin. Ketik ulang manual atau salin persis dari kotak di atas.</p>
          </div>
        )}
        {logos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {logos.map((src, i) => (
              <div key={i} className="relative group rounded-lg border border-border/50 bg-black/20 h-14 w-28 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`logo ${i + 1}`} className="max-h-9 max-w-[88px] object-contain" />
                <button onClick={() => { save(logos.filter((_, j) => j !== i)); toast.success('Logo dihapus') }} className="absolute top-0.5 right-0.5 rounded-md bg-black/60 p-0.5 text-white/70 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <label className={`inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity ${uploading ? 'opacity-60 pointer-events-none' : 'hover:opacity-90'}`}>
          {uploading ? <><Loader2 size={15} className="animate-spin" /> Mengupload…</> : <><Upload size={15} /> Upload Logo (bisa banyak)</>}
          <input type="file" accept="image/png,image/svg+xml,image/webp" multiple className="hidden" onChange={e => { if (e.target.files?.length) handleUpload(e.target.files) }} />
        </label>
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Panduan Ukuran Logo</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
            <li><strong>Format:</strong> PNG transparan, SVG, atau WebP — <strong>logo putih/terang</strong> (tampil di latar gelap, otomatis grayscale).</li>
            <li><strong>Tinggi ideal: 60–80 px</strong>, lebar bebas (landscape), sekitar <strong>200 × 64 px</strong>.</li>
            <li><strong>Background transparan</strong> — hindari kotak putih di belakang logo.</li>
            <li><strong>File maksimal:</strong> 500 KB per logo.</li>
            <li>Bila belum ada logo diupload, slider memakai nama broker berbentuk teks.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Logo metode pembayaran (bank/QRIS/e-wallet) yang tampil di section HARGA ──
function PaymentLogosManager() {
  const [logos, setLogos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('payment_logos').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setNeedsMigration(true); return }
        const pl = data?.payment_logos; if (Array.isArray(pl)) setLogos(pl.filter((x): x is string => typeof x === 'string'))
      })
  }, [])

  async function save(next: string[]) {
    setLogos(next)
    const { error } = await createClient().from('app_config')
      .upsert({ id: 1, payment_logos: next, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) { setNeedsMigration(true); toast.error('Gagal menyimpan: ' + error.message) }
  }

  async function handleUpload(files: FileList) {
    setUploading(true)
    try {
      const sb = createClient()
      const urls: string[] = []
      for (const file of Array.from(files)) {
        if (file.size > 500_000) { toast.error(`"${file.name}" > 500 KB, dilewati`); continue }
        const ext = file.name.split('.').pop() || 'png'
        const path = `landing/pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error } = await sb.storage.from('trade-screenshots').upload(path, file, { upsert: true })
        if (error) { toast.error('Upload gagal: ' + error.message); continue }
        urls.push(sb.storage.from('trade-screenshots').getPublicUrl(path).data.publicUrl)
      }
      if (urls.length) { await save([...logos, ...urls]); toast.success(`${urls.length} logo pembayaran ditambahkan`) }
    } catch { toast.error('Upload gagal') } finally { setUploading(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ImageIcon size={15} className="text-primary" /> Logo Metode Pembayaran (Section Harga)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {needsMigration && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <p className="font-bold text-amber-500 mb-1.5">⚠ Kolom database belum ada — jalankan SQL ini di Supabase → SQL Editor, lalu refresh:</p>
            <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-xs text-emerald-300 overflow-x-auto whitespace-pre">alter table app_config add column if not exists payment_logos jsonb not null default $$[]$$::jsonb;</code>
          </div>
        )}
        {logos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {logos.map((src, i) => (
              <div key={i} className="relative group rounded-lg border border-border/50 bg-white/90 h-14 w-24 flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`pembayaran ${i + 1}`} className="max-h-9 max-w-[80px] object-contain" />
                <button onClick={() => { save(logos.filter((_, j) => j !== i)); toast.success('Logo dihapus') }} className="absolute top-0.5 right-0.5 rounded-md bg-black/60 p-0.5 text-white/70 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <label className={`inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold cursor-pointer transition-opacity ${uploading ? 'opacity-60 pointer-events-none' : 'hover:opacity-90'}`}>
          {uploading ? <><Loader2 size={15} className="animate-spin" /> Mengupload…</> : <><Upload size={15} /> Upload Logo Pembayaran (bisa banyak)</>}
          <input type="file" accept="image/png,image/svg+xml,image/webp" multiple className="hidden" onChange={e => { if (e.target.files?.length) handleUpload(e.target.files) }} />
        </label>
        <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Panduan</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside leading-relaxed">
            <li>Logo bank/QRIS/e-wallet (mis. BCA, Mandiri, QRIS, GoPay, OVO, Dana, Visa, Mastercard).</li>
            <li><strong>Format:</strong> PNG/SVG/WebP — <strong>logo berwarna asli</strong> (ditampilkan apa adanya, tidak grayscale).</li>
            <li><strong>Tinggi ideal: 40–60 px</strong>, background transparan. <strong>Maks 500 KB</strong> per logo.</li>
            <li>Bila kosong, section harga hanya menampilkan teks metode pembayaran.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Meta Pixel (Facebook/Instagram Ads) — set Pixel ID + on/off dari sini ──
// Disimpan di app_config (meta_pixel_id, meta_pixel_enabled). Pixel ID bersifat PUBLIK
// (memang ditanam di setiap halaman) — tak ada rahasia di sini.
const PIXEL_EVENTS: { ev: string; when: string }[] = [
  { ev: 'PageView', when: 'Setiap halaman dibuka (otomatis)' },
  { ev: 'ViewContent', when: 'Buka halaman upgrade / penawaran Pro' },
  { ev: 'Lead', when: 'Sampai di halaman checkout (intent beli)' },
  { ev: 'CompleteRegistration', when: 'Pendaftaran akun berhasil' },
  { ev: 'InitiateCheckout', when: 'Klik tombol Bayar' },
  { ev: 'Purchase', when: 'Pembayaran aktif (nilai + IDR, anti-dobel)' },
]
function MetaPixelManager() {
  const [pixelId, setPixelId] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)

  useEffect(() => {
    createClient().from('app_config').select('meta_pixel_id, meta_pixel_enabled').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setNeedsMigration(true); setLoading(false); return }
        setPixelId((data?.meta_pixel_id as string | null) ?? '')
        setEnabled(!!data?.meta_pixel_enabled)
        setLoading(false)
      })
  }, [])

  async function save() {
    const id = pixelId.trim()
    if (enabled && !/^\d{6,20}$/.test(id)) { toast.error('Pixel ID harus berupa angka (6–20 digit).'); return }
    setSaving(true)
    const { error } = await createClient().from('app_config')
      .upsert({ id: 1, meta_pixel_id: id || null, meta_pixel_enabled: enabled, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    setSaving(false)
    if (error) { toast.error('Gagal menyimpan: ' + error.message); return }
    toast.success('Pengaturan Meta Pixel disimpan. Perubahan aktif ≤30 detik.')
  }

  const active = enabled && /^\d{6,20}$/.test(pixelId.trim())

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Megaphone size={15} className="text-primary" /> Meta Pixel — Facebook / Instagram Ads</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {needsMigration ? (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
            <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><AlertTriangle size={13} /> Perlu migrasi database sekali</p>
            <p className="text-xs text-amber-200/80">Jalankan SQL ini di Supabase (SQL Editor), lalu muat ulang halaman:</p>
            <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-xs text-emerald-300 overflow-x-auto whitespace-pre">alter table app_config
  add column if not exists meta_pixel_id text,
  add column if not exists meta_pixel_enabled boolean not null default false;</code>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={18} /></div>
        ) : (
          <>
            {/* Status */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/50'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-white/40'}`} />{active ? 'Terpasang & aktif' : 'Nonaktif'}
              </span>
            </div>

            {/* Pixel ID */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Pixel ID (dari Meta Events Manager)</label>
              <input value={pixelId} onChange={e => setPixelId(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="mis. 1234567890123456"
                className="mt-1.5 w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50 tabular-nums" />
              <p className="text-[11px] text-muted-foreground/70 mt-1.5">Meta Events Manager → Data Sources → pilih pixel → salin <strong>Dataset/Pixel ID</strong> (hanya angka).</p>
            </div>

            {/* Toggle aktif */}
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 cursor-pointer">
              <span className="text-sm"><strong>Aktifkan pelacakan</strong><br /><span className="text-xs text-muted-foreground">Matikan kapan saja tanpa menghapus Pixel ID.</span></span>
              <button type="button" onClick={() => setEnabled(v => !v)} className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-white/15'}`}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </label>

            <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">{saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : 'Simpan Pengaturan'}</Button>

            {/* Daftar event */}
            <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Event yang otomatis terkirim</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {PIXEL_EVENTS.map(e => <li key={e.ev} className="flex gap-2"><code className="text-emerald-300 text-xs shrink-0 w-40">{e.ev}</code><span className="text-xs">{e.when}</span></li>)}
              </ul>
              <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">Uji dengan ekstensi <strong>Meta Pixel Helper</strong> (Chrome) atau tab <strong>Test Events</strong> di Events Manager. Catatan: pelacakan browser bisa terpengaruh ad-blocker/iOS — sebagian konversi mungkin tak tercatat (batasan wajar pixel client-side).</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ── SEO & Analytics: GA4 + Google Search Console (verifikasi + sitemap/robots) + meta situs ──
function SeoManager() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [siteUrl, setSiteUrl] = useState('')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [gaId, setGaId] = useState('')
  const [gaEnabled, setGaEnabled] = useState(false)
  const [gsc, setGsc] = useState('')

  useEffect(() => {
    createClient().from('app_config').select('site_url, seo_title, seo_description, ga_measurement_id, ga_enabled, gsc_verification').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { setNeedsMigration(true); setLoading(false); return }
        setSiteUrl((data?.site_url as string | null) ?? '')
        setTitle((data?.seo_title as string | null) ?? '')
        setDesc((data?.seo_description as string | null) ?? '')
        setGaId((data?.ga_measurement_id as string | null) ?? '')
        setGaEnabled(!!data?.ga_enabled)
        setGsc((data?.gsc_verification as string | null) ?? '')
        setLoading(false)
      })
  }, [])

  async function save() {
    if (gaEnabled && gaId.trim() && !/^G-[A-Z0-9]{6,}$/i.test(gaId.trim())) { toast.error('Measurement ID GA4 harus format G-XXXXXXXX'); return }
    setSaving(true)
    const { error } = await createClient().from('app_config').upsert({
      id: 1, site_url: siteUrl.trim() || null, seo_title: title.trim() || null, seo_description: desc.trim() || null,
      ga_measurement_id: gaId.trim() || null, ga_enabled: gaEnabled, gsc_verification: gsc.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    setSaving(false)
    if (error) { toast.error('Gagal menyimpan: ' + error.message); return }
    toast.success('Pengaturan SEO disimpan. Aktif ≤30 detik (situs perlu re-deploy untuk metadata build).')
  }

  if (needsMigration) return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe size={15} className="text-primary" /> SEO & Analytics</CardTitle></CardHeader>
      <CardContent>
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
          <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><AlertTriangle size={13} /> Perlu migrasi database sekali</p>
          <p className="text-xs text-amber-200/80">Jalankan SQL ini di Supabase (SQL Editor), lalu muat ulang halaman:</p>
          <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-xs text-emerald-300 overflow-x-auto whitespace-pre">alter table app_config
  add column if not exists site_url text,
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists ga_measurement_id text,
  add column if not exists ga_enabled boolean not null default false,
  add column if not exists gsc_verification text;</code>
        </div>
      </CardContent>
    </Card>
  )
  if (loading) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={18} /></CardContent></Card>

  const base = (siteUrl.trim() || 'https://datalitiq.com').replace(/\/$/, '')
  const gaActive = gaEnabled && /^G-[A-Z0-9]{6,}$/i.test(gaId.trim())

  return (
    <>
      {/* Meta & identitas situs */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe size={15} className="text-primary" /> Meta & Identitas Situs</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">URL Situs (canonical)</label>
            <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} placeholder="https://datalitiq.com" className="mt-1.5 w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <p className="text-[11px] text-muted-foreground/70 mt-1">Dipakai untuk canonical, Open Graph, sitemap & robots.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Judul (title)</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Datalitiq AI Terminal — Analisa Emas…" className="mt-1.5 w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <p className="text-[11px] text-muted-foreground/70 mt-1">{(title || '').length} karakter · ideal 50–60.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Deskripsi (meta description)</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} placeholder="Ringkasan situs untuk hasil pencarian…" className="mt-1.5 w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
            <p className="text-[11px] text-muted-foreground/70 mt-1">{(desc || '').length} karakter · ideal 140–160.</p>
          </div>
        </CardContent>
      </Card>

      {/* Google Analytics */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity size={15} className="text-primary" /> Google Analytics (GA4)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${gaActive ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/10 text-white/50'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${gaActive ? 'bg-emerald-400' : 'bg-white/40'}`} />{gaActive ? 'Terpasang & aktif' : 'Nonaktif'}
          </span>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Measurement ID</label>
            <input value={gaId} onChange={e => setGaId(e.target.value)} placeholder="G-XXXXXXXXXX" className="mt-1.5 w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <p className="text-[11px] text-muted-foreground/70 mt-1">GA4 → Admin → Data Streams → salin <strong>Measurement ID</strong> (format G-…).</p>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 cursor-pointer">
            <span className="text-sm"><strong>Aktifkan pelacakan GA4</strong><br /><span className="text-xs text-muted-foreground">Lacak kunjungan & halaman (termasuk navigasi SPA).</span></span>
            <button type="button" onClick={() => setGaEnabled(v => !v)} className={`relative w-11 h-6 rounded-full transition-colors ${gaEnabled ? 'bg-primary' : 'bg-white/15'}`}>
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${gaEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </CardContent>
      </Card>

      {/* Google Search Console */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Search size={15} className="text-primary" /> Google Search Console</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Kode Verifikasi (meta tag)</label>
            <input value={gsc} onChange={e => setGsc(e.target.value)} placeholder="isi value dari <meta name=&quot;google-site-verification&quot;>" className="mt-1.5 w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <p className="text-[11px] text-muted-foreground/70 mt-1">GSC → Tambah properti → metode <strong>Tag HTML</strong> → salin isi <code>content=&quot;…&quot;</code> saja (bukan seluruh tag). Otomatis ditanam di <code>&lt;head&gt;</code>.</p>
          </div>
          <div className="rounded-xl bg-muted/30 border border-border/40 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Info size={12} /> Sitemap & Robots (otomatis)</p>
            <div className="space-y-1.5 text-sm">
              <a href={`${base}/sitemap.xml`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline"><ExternalLink size={12} /> {base}/sitemap.xml</a>
              <a href={`${base}/robots.txt`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-primary hover:underline"><ExternalLink size={12} /> {base}/robots.txt</a>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">Langkah submit: (1) verifikasi properti dengan kode di atas, (2) di GSC buka <strong>Sitemaps</strong> → masukkan <code>sitemap.xml</code> → Kirim. Google akan meng-crawl otomatis; pengindeksan butuh beberapa hari.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : 'Simpan Pengaturan SEO'}</Button>
    </>
  )
}

// ── Daily Outlook XAU/USD — admin tulis materi harian, tampil di Hub & /daily-outlook ──
type OutlookRow = { id: string; outlook_date: string; title: string; bias: string; summary: string | null; content: string | null; support: string | null; resistance: string | null; published: boolean }
const blankOutlook = (): OutlookRow => ({ id: '', outlook_date: new Date().toISOString().slice(0, 10), title: '', bias: 'netral', summary: '', content: '', support: '', resistance: '', published: true })
const MIG_OUTLOOK = `create table if not exists daily_outlook (
  id uuid primary key default gen_random_uuid(),
  outlook_date date not null default current_date,
  title text not null, bias text not null default 'netral',
  summary text, content text, support text, resistance text,
  published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table daily_outlook enable row level security;
create policy "outlook read published" on daily_outlook for select using (published = true);
create policy "outlook admin all" on daily_outlook for all
  using (auth.jwt()->>'email' = 'vultype@gmail.com') with check (auth.jwt()->>'email' = 'vultype@gmail.com');`

function MigrationBanner({ sql }: { sql: string }) {
  return (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-2">
      <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><AlertTriangle size={13} /> Perlu migrasi database sekali</p>
      <p className="text-xs text-amber-200/80">Jalankan SQL ini di Supabase (SQL Editor), lalu muat ulang halaman:</p>
      <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-[11px] text-emerald-300 overflow-x-auto whitespace-pre">{sql}</code>
    </div>
  )
}

const biasOpt = [{ v: 'bullish', t: 'Bullish' }, { v: 'bearish', t: 'Bearish' }, { v: 'netral', t: 'Netral' }]
const inp = 'w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50'

function DailyOutlookManager() {
  const [rows, setRows] = useState<OutlookRow[] | null>(null)
  const [edit, setEdit] = useState<OutlookRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)

  async function load() {
    const { data, error } = await createClient().from('daily_outlook').select('*').order('outlook_date', { ascending: false }).limit(60)
    if (error) { setNeedsMigration(true); setRows([]); return }
    setRows((data as OutlookRow[]) ?? [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!edit) return
    if (!edit.title.trim()) { toast.error('Judul wajib diisi'); return }
    setSaving(true)
    const p = { outlook_date: edit.outlook_date, title: edit.title.trim(), bias: edit.bias, summary: edit.summary || null, content: edit.content || null, support: edit.support || null, resistance: edit.resistance || null, published: edit.published, updated_at: new Date().toISOString() }
    const { error } = edit.id
      ? await createClient().from('daily_outlook').update(p).eq('id', edit.id)
      : await createClient().from('daily_outlook').insert(p)
    setSaving(false)
    if (error) { toast.error('Gagal: ' + error.message); return }
    toast.success('Outlook disimpan'); setEdit(null); load()
  }
  async function del(id: string) { if (!confirm('Hapus outlook ini?')) return; const { error } = await createClient().from('daily_outlook').delete().eq('id', id); if (error) return toast.error(error.message); toast.success('Dihapus'); load() }
  async function togglePub(r: OutlookRow) { const { error } = await createClient().from('daily_outlook').update({ published: !r.published, updated_at: new Date().toISOString() }).eq('id', r.id); if (error) return toast.error(error.message); load() }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><CalendarDays size={15} className="text-primary" /> Daily Outlook XAU/USD</CardTitle>
        {!needsMigration && !edit && <Button size="sm" className="gap-1.5" onClick={() => setEdit(blankOutlook())}><Plus size={14} /> Tulis Outlook</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {needsMigration ? <MigrationBanner sql={MIG_OUTLOOK} /> : edit ? (
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-muted-foreground">Tanggal</label><input type="date" value={edit.outlook_date} onChange={e => setEdit({ ...edit, outlook_date: e.target.value })} className={`${inp} mt-1`} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Bias</label><select value={edit.bias} onChange={e => setEdit({ ...edit, bias: e.target.value })} className={`${inp} mt-1`}>{biasOpt.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}</select></div>
            </div>
            <div><label className="text-xs font-semibold text-muted-foreground">Judul</label><input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="mis. Emas konsolidasi jelang CPI" className={`${inp} mt-1`} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Ringkasan (1–2 kalimat)</label><textarea value={edit.summary ?? ''} onChange={e => setEdit({ ...edit, summary: e.target.value })} rows={2} className={`${inp} mt-1 resize-none`} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-muted-foreground">Support</label><input value={edit.support ?? ''} onChange={e => setEdit({ ...edit, support: e.target.value })} placeholder="mis. 2380 / 2360" className={`${inp} mt-1`} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">Resistance</label><input value={edit.resistance ?? ''} onChange={e => setEdit({ ...edit, resistance: e.target.value })} placeholder="mis. 2420 / 2445" className={`${inp} mt-1`} /></div>
            </div>
            <div><label className="text-xs font-semibold text-muted-foreground">Materi lengkap (Markdown)</label><textarea value={edit.content ?? ''} onChange={e => setEdit({ ...edit, content: e.target.value })} rows={8} placeholder="## Skenario&#10;- Bila tembus 2420 ...&#10;**Catatan:** ..." className={`${inp} mt-1 font-mono text-[13px]`} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={edit.published} onChange={e => setEdit({ ...edit, published: e.target.checked })} /> Tampilkan ke user (published)</label>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : 'Simpan'}</Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Batal</Button>
            </div>
          </div>
        ) : rows === null ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={18} /></div>
          : rows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Belum ada outlook. Klik “Tulis Outlook”.</p>
            : (
              <div className="divide-y divide-white/[0.06]">
                {rows.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0 ${r.bias === 'bullish' ? 'bg-emerald-500/15 text-emerald-400' : r.bias === 'bearish' ? 'bg-red-500/15 text-red-400' : 'bg-white/10 text-white/50'}`}>{r.bias}</span>
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{r.title}</p><p className="text-[10px] text-muted-foreground">{r.outlook_date}{!r.published && ' · draft'}</p></div>
                    <button onClick={() => togglePub(r)} title={r.published ? 'Sembunyikan' : 'Terbitkan'} className={`p-1.5 rounded-lg hover:bg-white/5 ${r.published ? 'text-emerald-400' : 'text-white/40'}`}>{r.published ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                    <button onClick={() => setEdit(r)} title="Edit" className="p-1.5 rounded-lg text-white/60 hover:bg-white/5"><Pencil size={15} /></button>
                    <button onClick={() => del(r.id)} title="Hapus" className="p-1.5 rounded-lg text-red-400/70 hover:bg-white/5"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
      </CardContent>
    </Card>
  )
}

// ── Blog — admin kelola artikel, tampil publik di /blog & /blog/[slug] ──
type BlogRow = { id: string; slug: string; title: string; excerpt: string | null; cover_url: string | null; content: string | null; tag: string | null; published: boolean; published_at: string | null }
const blankBlog = (): BlogRow => ({ id: '', slug: '', title: '', excerpt: '', cover_url: '', content: '', tag: '', published: false, published_at: null })
const slugify = (s: string) => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 80)
const MIG_BLOG = `create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null, title text not null,
  excerpt text, cover_url text, content text, tag text,
  published boolean not null default false, published_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table blog_posts enable row level security;
create policy "blog read published" on blog_posts for select using (published = true);
create policy "blog admin all" on blog_posts for all
  using (auth.jwt()->>'email' = 'vultype@gmail.com') with check (auth.jwt()->>'email' = 'vultype@gmail.com');`

function BlogManager() {
  const [rows, setRows] = useState<BlogRow[] | null>(null)
  const [edit, setEdit] = useState<BlogRow | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)

  async function load() {
    const { data, error } = await createClient().from('blog_posts').select('*').order('created_at', { ascending: false })
    if (error) { setNeedsMigration(true); setRows([]); return }
    setRows((data as BlogRow[]) ?? [])
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startNew() { setEdit(blankBlog()); setSlugTouched(false) }
  function startEdit(r: BlogRow) { setEdit(r); setSlugTouched(true) }

  async function save() {
    if (!edit) return
    if (!edit.title.trim()) { toast.error('Judul wajib diisi'); return }
    const slug = (edit.slug.trim() || slugify(edit.title))
    if (!slug) { toast.error('Slug tidak valid'); return }
    setSaving(true)
    const wasPublished = rows?.find(r => r.id === edit.id)?.published
    const p: Record<string, unknown> = {
      slug, title: edit.title.trim(), excerpt: edit.excerpt || null, cover_url: edit.cover_url || null,
      content: edit.content || null, tag: edit.tag || null, published: edit.published, updated_at: new Date().toISOString(),
    }
    if (edit.published && !wasPublished) p.published_at = new Date().toISOString()
    const { error } = edit.id
      ? await createClient().from('blog_posts').update(p).eq('id', edit.id)
      : await createClient().from('blog_posts').insert(p)
    setSaving(false)
    if (error) { toast.error(/duplicate|unique/i.test(error.message) ? 'Slug sudah dipakai artikel lain' : 'Gagal: ' + error.message); return }
    toast.success('Artikel disimpan'); setEdit(null); load()
  }
  async function del(id: string) { if (!confirm('Hapus artikel ini?')) return; const { error } = await createClient().from('blog_posts').delete().eq('id', id); if (error) return toast.error(error.message); toast.success('Dihapus'); load() }
  async function togglePub(r: BlogRow) { const patch: Record<string, unknown> = { published: !r.published, updated_at: new Date().toISOString() }; if (!r.published && !r.published_at) patch.published_at = new Date().toISOString(); const { error } = await createClient().from('blog_posts').update(patch).eq('id', r.id); if (error) return toast.error(error.message); load() }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Newspaper size={15} className="text-primary" /> Blog</CardTitle>
        {!needsMigration && !edit && <Button size="sm" className="gap-1.5" onClick={startNew}><Plus size={14} /> Artikel Baru</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {needsMigration ? <MigrationBanner sql={MIG_BLOG} /> : edit ? (
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
            <div><label className="text-xs font-semibold text-muted-foreground">Judul</label><input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value, slug: slugTouched ? edit.slug : slugify(e.target.value) })} className={`${inp} mt-1`} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Slug (URL)</label><input value={edit.slug} onChange={e => { setSlugTouched(true); setEdit({ ...edit, slug: slugify(e.target.value) }) }} placeholder="judul-artikel" className={`${inp} mt-1 font-mono text-[13px]`} /><p className="text-[11px] text-muted-foreground/70 mt-1">/blog/{edit.slug || 'judul-artikel'}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs font-semibold text-muted-foreground">Tag/Kategori</label><input value={edit.tag ?? ''} onChange={e => setEdit({ ...edit, tag: e.target.value })} placeholder="mis. Edukasi" className={`${inp} mt-1`} /></div>
              <div><label className="text-xs font-semibold text-muted-foreground">URL Gambar Cover</label><input value={edit.cover_url ?? ''} onChange={e => setEdit({ ...edit, cover_url: e.target.value })} placeholder="https://…" className={`${inp} mt-1`} /></div>
            </div>
            <div><label className="text-xs font-semibold text-muted-foreground">Ringkasan (excerpt)</label><textarea value={edit.excerpt ?? ''} onChange={e => setEdit({ ...edit, excerpt: e.target.value })} rows={2} className={`${inp} mt-1 resize-none`} /></div>
            <div><label className="text-xs font-semibold text-muted-foreground">Isi Artikel (Markdown)</label><textarea value={edit.content ?? ''} onChange={e => setEdit({ ...edit, content: e.target.value })} rows={12} placeholder="# Judul&#10;&#10;Paragraf...&#10;&#10;## Sub-judul&#10;- poin" className={`${inp} mt-1 font-mono text-[13px]`} /></div>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={edit.published} onChange={e => setEdit({ ...edit, published: e.target.checked })} /> Terbitkan (published)</label>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">{saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : 'Simpan'}</Button>
              <Button size="sm" variant="outline" onClick={() => setEdit(null)}>Batal</Button>
              {edit.id && edit.published && <a href={`/blog/${edit.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline ml-auto self-center">Lihat <ExternalLink size={12} /></a>}
            </div>
          </div>
        ) : rows === null ? <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={18} /></div>
          : rows.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">Belum ada artikel. Klik “Artikel Baru”.</p>
            : (
              <div className="divide-y divide-white/[0.06]">
                {rows.map(r => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    {r.tag && <span className="text-[9px] font-bold uppercase rounded-full px-2 py-0.5 shrink-0 bg-primary/12 text-primary">{r.tag}</span>}
                    <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{r.title}</p><p className="text-[10px] text-muted-foreground">/blog/{r.slug}{!r.published && ' · draft'}</p></div>
                    <button onClick={() => togglePub(r)} title={r.published ? 'Sembunyikan' : 'Terbitkan'} className={`p-1.5 rounded-lg hover:bg-white/5 ${r.published ? 'text-emerald-400' : 'text-white/40'}`}>{r.published ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                    <button onClick={() => startEdit(r)} title="Edit" className="p-1.5 rounded-lg text-white/60 hover:bg-white/5"><Pencil size={15} /></button>
                    <button onClick={() => del(r.id)} title="Hapus" className="p-1.5 rounded-lg text-red-400/70 hover:bg-white/5"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
      </CardContent>
    </Card>
  )
}

// ── Beri Akses Pro Manual — admin buat langganan 'aktif' langsung utk email tertentu ──
// (gratis/komplimen/testing). Insert payment_orders via sesi admin (RLS: policy "admin
// orders" for all using is_admin() — sudah tersedia, tak perlu service_role/API terpisah).
type GrantUnit = 'hari' | 'bulan'
const GRANT_PRESETS: { label: string; amount: number; unit: GrantUnit }[] = [
  { label: '7 hari', amount: 7, unit: 'hari' },
  { label: '30 hari', amount: 30, unit: 'hari' },
  { label: '3 bulan', amount: 3, unit: 'bulan' },
  { label: '6 bulan', amount: 6, unit: 'bulan' },
  { label: '1 tahun', amount: 12, unit: 'bulan' },
]
function ManualProGrant({ users, onGranted }: { users: AdminUser[]; onGranted: () => void }) {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('30')
  const [unit, setUnit] = useState<GrantUnit>('hari')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const match = users.filter(u => email.trim().length > 1 && u.email.toLowerCase().includes(email.trim().toLowerCase())).slice(0, 6)
  const exact = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
  const emailLooksComplete = /\S+@\S+\.\S+/.test(email.trim())
  const amt = Math.max(1, Math.floor(Number(amount) || 0))
  const expires = unit === 'hari' ? new Date(Date.now() + amt * 86_400_000) : addMonths(new Date(), amt)
  const monthsVal = unit === 'bulan' ? amt : Math.max(1, Math.ceil(amt / 30))

  async function grant() {
    if (!exact) { toast.error('Email belum terdaftar. Minta user daftar dulu, atau pakai SQL manual di bawah.'); return }
    setBusy(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { toast.error('Sesi habis, login ulang.'); setBusy(false); return }
      const res = await fetch('/api/admin/grant-pro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: exact.id, email: exact.email, months: monthsVal, expiresAt: expires.toISOString() }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(j.error || 'Gagal memberikan akses.'); setBusy(false); return }
      toast.success(`${exact.email} sekarang Pro — berlaku sampai ${fmtDate(expires)}`)
      setEmail(''); setOpen(false); onGranted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan')
    } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Crown size={15} className="text-primary" /> Beri Akses Pro Manual</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Aktifkan Pro langsung untuk user tertentu tanpa pembayaran (komplimen/testing). User harus sudah pernah daftar/login.</p>
        <div className="relative">
          <input value={email} onChange={e => { setEmail(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Cari email user…" className="w-full rounded-lg border border-border/60 bg-black/20 px-3 py-2 text-sm outline-none focus:border-primary/50" />
          {open && match.length > 0 && !exact && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-border/60 bg-[#0b0f0e] shadow-xl overflow-hidden">
              {match.map(u => <button key={u.id} onClick={() => { setEmail(u.email); setOpen(false) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors">{u.email}</button>)}
            </div>
          )}
        </div>
        {emailLooksComplete && !exact && <p className="text-[11px] text-amber-400 flex items-center gap-1"><AlertTriangle size={11} /> Email ini belum terdaftar di sistem — minta user daftar dulu.</p>}

        {/* Durasi: preset + custom (hari/bulan) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {GRANT_PRESETS.map(p => {
              const on = amt === p.amount && unit === p.unit
              return <button key={p.label} onClick={() => { setAmount(String(p.amount)); setUnit(p.unit) }} className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${on ? 'bg-primary text-primary-foreground' : 'bg-white/5 text-white/50 hover:text-white/80'}`}>{p.label}</button>
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Custom:</span>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" className="w-20 rounded-lg border border-border/60 bg-black/20 px-3 py-1.5 text-sm font-bold tabular-nums outline-none focus:border-primary/50" />
            <div className="flex gap-0.5 rounded-lg bg-black/30 p-0.5 border border-border/60">
              {(['hari', 'bulan'] as GrantUnit[]).map(u => <button key={u} onClick={() => setUnit(u)} className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${unit === u ? 'bg-primary text-primary-foreground' : 'text-white/45 hover:text-white/70'}`}>{u}</button>)}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground/70">Berlaku sampai <b className="text-white/70">{fmtDate(expires)}</b> ({amt} {unit})</p>
        </div>

        <Button onClick={grant} disabled={busy || !exact} size="sm" className="gap-1.5">{busy ? <><Loader2 size={14} className="animate-spin" /> Memproses…</> : <><Crown size={14} /> Berikan Akses Pro</>}</Button>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-white/70">Alternatif: SQL manual (bila tombol gagal / user belum bisa dicari)</summary>
          <p className="text-[11px] text-muted-foreground/70 mt-2">Jalankan di Supabase → SQL Editor (ganti email & durasi sesuai kebutuhan). Bekerja meski RLS/is_admin belum di-setup:</p>
          <code className="block rounded-lg bg-black/40 border border-border/50 px-3 py-2 text-[11px] text-emerald-300 overflow-x-auto whitespace-pre mt-1.5">{`insert into payment_orders (user_id, plan, months, base_amount, unique_code, total, status, method, expires_at)
select id, 'terminal', 12, 0, 0, 0, 'aktif', 'admin_grant', now() + interval '365 days'
from auth.users where email = 'cahyaduadelapan@gmail.com';`}</code>
        </details>
      </CardContent>
    </Card>
  )
}

// ── Dev Tools — testing manual komponen UI (toast, confetti) tanpa perlu memicu alur asli ──
// ————— Kirim Email Manual —————
// Admin memilih user + template, melihat pratinjau, lalu mengirim.
// Nominal & kode unik diambil server-side dari order user, tidak diketik manual.
function EmailManager({ users }: { users: UserRow[] }) {
  const [q, setQ] = useState('')
  const [uid, setUid] = useState('')
  const [tplId, setTplId] = useState<TemplateId>('checkout_pending')
  const [expiresAt, setExpiresAt] = useState('')
  const [daysLeft, setDaysLeft] = useState('')
  const [slaText, setSlaText] = useState('')
  const [html, setHtml] = useState('')
  const [subject, setSubject] = useState('')
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null)
  const [log, setLog] = useState<{ template: string; subject: string; created_at: string }[]>([])
  const [hasOrder, setHasOrder] = useState<boolean | null>(null)

  const tpl = TEMPLATES.find(t => t.id === tplId)!
  const picked = users.find(u => u.id === uid) || null
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (s ? users.filter(u => u.email.toLowerCase().includes(s)) : users).slice(0, 40)
  }, [users, q])

  async function call(mode: 'preview' | 'send') {
    if (!uid) { toast.error('Pilih user dulu'); return }
    if (mode === 'send' && !window.confirm(`Kirim "${tpl.label}" ke ${picked?.email}?\n\nEmail akan langsung terkirim ke user.`)) return
    setBusy(mode)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { toast.error('Sesi habis, login ulang'); return }
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: uid, templateId: tplId, preview: mode === 'preview',
          overrides: { expiresAt: expiresAt || undefined, daysLeft: daysLeft ? Number(daysLeft) : undefined, slaText: slaText || undefined },
        }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Gagal'); return }
      setSubject(j.subject || '')
      if (typeof j.hasOrder === 'boolean') setHasOrder(j.hasOrder)
      if (mode === 'preview') { setHtml(j.html || ''); toast.success('Pratinjau dimuat') }
      else { toast.success(`Terkirim ke ${j.to}`); if (j.logNote) toast.info(j.logNote); loadLog(uid) }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal') } finally { setBusy(null) }
  }

  async function loadLog(id: string) {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session || !id) return
    const res = await fetch(`/api/admin/send-email?userId=${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
    const j = await res.json().catch(() => ({ log: [] }))
    setLog(j.log || [])
  }
  useEffect(() => { setHtml(''); setHasOrder(null); if (uid) loadLog(uid) }, [uid])

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Mail size={16} /> Kirim Email ke User</CardTitle></CardHeader>
      <CardContent className="space-y-5">

        {/* 1. Pilih user */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">1 · Pilih Penerima</p>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari email…"
            className="w-full h-9 px-2.5 mb-2 rounded-md bg-background border border-border/60 text-[12px] outline-none focus:border-primary/60" />
          <div className="max-h-52 overflow-y-auto rounded-lg border border-border/50 divide-y divide-border/40">
            {shown.length === 0 ? <p className="p-3 text-[12px] text-muted-foreground">Tidak ada user cocok.</p> : shown.map(u => (
              <button key={u.id} onClick={() => setUid(u.id)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors ${uid === u.id ? 'bg-primary/15' : 'hover:bg-white/5'}`}>
                <span className="text-[12px] truncate">{u.email}</span>
                <Badge variant={u.sub === 'pro' ? 'default' : 'outline'} className="text-[10px] shrink-0">
                  {u.sub === 'pro' ? 'Pro' : u.sub === 'expired' ? 'Expired' : 'Free'}
                </Badge>
              </button>
            ))}
          </div>
          {picked && <p className="text-[11px] text-muted-foreground mt-1.5">Penerima: <b className="text-foreground">{picked.email}</b></p>}
        </div>

        {/* 2. Pilih template */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">2 · Pilih Template</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {TEMPLATES.map(t => (
              <button key={t.id} onClick={() => { setTplId(t.id); setHtml('') }}
                className={`text-left rounded-lg border p-3 transition-colors ${tplId === t.id ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-white/5'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[12px] font-semibold">{t.label}</span>
                  {t.usesOrder && <Badge variant="outline" className="text-[9px] px-1">2 varian</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Variabel opsional — hanya yang relevan dengan template terpilih */}
        {(tplId === 'pro_active' || tplId === 'pro_expiring' || tplId === 'checkout_pending') && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">3 · Isian Tambahan</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {tplId === 'checkout_pending' && (
                <div><label className="text-[11px] font-semibold text-muted-foreground block mb-1">Janji aktivasi</label>
                  <input value={slaText} onChange={e => setSlaText(e.target.value)} placeholder="1x24 jam"
                    className="w-full h-9 px-2.5 rounded-md bg-background border border-border/60 text-[12px] outline-none focus:border-primary/60" /></div>
              )}
              {(tplId === 'pro_active' || tplId === 'pro_expiring') && (
                <div><label className="text-[11px] font-semibold text-muted-foreground block mb-1">Berlaku sampai</label>
                  <input value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                    placeholder={picked?.expiresAt ? fmtDate(picked.expiresAt) : '20 Agu 2026'}
                    className="w-full h-9 px-2.5 rounded-md bg-background border border-border/60 text-[12px] outline-none focus:border-primary/60" /></div>
              )}
              {tplId === 'pro_expiring' && (
                <div><label className="text-[11px] font-semibold text-muted-foreground block mb-1">Sisa hari</label>
                  <input type="number" value={daysLeft} onChange={e => setDaysLeft(e.target.value)}
                    placeholder={picked?.daysLeft != null ? String(picked.daysLeft) : '3'}
                    className="w-full h-9 px-2.5 rounded-md bg-background border border-border/60 text-[12px] outline-none focus:border-primary/60" /></div>
              )}
            </div>
          </div>
        )}

        {/* 4. Pratinjau & kirim */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => call('preview')} disabled={busy !== null || !uid}>
            {busy === 'preview' ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Pratinjau
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => call('send')} disabled={busy !== null || !uid}>
            {busy === 'send' ? <><Loader2 size={13} className="animate-spin" /> Mengirim…</> : <><Mail size={13} /> Kirim Email</>}
          </Button>
        </div>

        {html && (
          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5">Subjek: <b className="text-foreground">{subject}</b></p>
            {tpl.usesOrder && hasOrder !== null && (
              <p className="text-[11px] mb-1.5">Varian: <b className={hasOrder ? 'text-emerald-400' : 'text-amber-400'}>
                {hasOrder ? 'ada order — nominal + kode unik disertakan' : 'tanpa order — diarahkan membuat pesanan, rekening tidak ditampilkan'}</b></p>
            )}
            {/* sandbox="" = tanpa script, tanpa akses same-origin. Pratinjau murni visual. */}
            <iframe srcDoc={html} sandbox="" title="Pratinjau email" className="w-full h-[520px] rounded-lg border border-border/50 bg-white" />
          </div>
        )}

        {log.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Riwayat Kirim</p>
            <div className="space-y-1">
              {log.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-border/30">
                  <span className="truncate">{TEMPLATES.find(t => t.id === l.template)?.label || l.template}</span>
                  <span className="text-muted-foreground shrink-0">{new Date(l.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}

type NotifChannel = { configured: boolean; ok: boolean; detail: string }
type NotifDiag = {
  config: { target: string; resendKey: boolean; resendFrom: string; usingDefaultFrom: boolean; telegram: boolean }
  result?: { email: NotifChannel; telegram: NotifChannel }
}

function DevToolsManager() {
  const [confettiKey, setConfettiKey] = useState<number | null>(null)
  const [diag, setDiag] = useState<NotifDiag | null>(null)
  const [notifBusy, setNotifBusy] = useState(false)
  const [notifTo, setNotifTo] = useState('')
  const [notifNote, setNotifNote] = useState('')

  function fireConfetti() {
    setConfettiKey(Date.now())
    setTimeout(() => setConfettiKey(null), 3600) // sedikit lebih lama dari durasi animasi (3500ms)
  }

  async function notifCall(method: 'GET' | 'POST') {
    setNotifBusy(true)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { toast.error('Sesi habis, login ulang'); return }
      const res = await fetch('/api/admin/notify-test', {
        method,
        headers: { Authorization: `Bearer ${session.access_token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        ...(method === 'POST' ? { body: JSON.stringify({ to: notifTo.trim(), note: notifNote.trim() }) } : {}),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Gagal'); return }
      setDiag(j)
      if (method === 'POST') {
        if (j.result?.email?.ok) toast.success(`Email terkirim ke ${j.sentTo} — cek inbox/spam`)
        else toast.error('Pengiriman gagal, lihat detail di bawah')
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal') } finally { setNotifBusy(false) }
  }
  useEffect(() => { notifCall('GET') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const Row = ({ ok, label, detail }: { ok: boolean; label: string; detail: string }) => (
    <div className="flex items-start gap-2 py-1">
      {ok ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" /> : <XCircle size={14} className="text-red-400 shrink-0 mt-0.5" />}
      <div className="min-w-0"><p className="text-[12px] font-semibold">{label}</p><p className="text-[11px] text-muted-foreground break-words">{detail}</p></div>
    </div>
  )

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wrench size={15} className="text-primary" /> Dev Tools — Testing Notifikasi</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">Uji tampilan komponen notifikasi tanpa perlu memicu alur asli (bayar, upgrade, dll). Hanya terlihat di admin.</p>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Bell size={12} /> Toast</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.success('Berhasil disimpan — ini contoh toast sukses.')}><CheckCircle2 size={14} className="text-emerald-400" /> Success</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.error('Gagal memproses — ini contoh toast error.')}><XCircle size={14} className="text-red-400" /> Error</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info('Informasi — ini contoh toast info.')}><Info size={14} className="text-sky-400" /> Info</Button>
          </div>
        </div>

        {/* Diagnosa notifikasi admin (email/Telegram) — menampilkan error asli provider */}
        <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5"><Megaphone size={12} /> Notifikasi Admin (Email / Telegram)</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => notifCall('GET')} disabled={notifBusy}><RefreshCw size={13} /> Cek Status</Button>
          </div>

          {/* Form uji kirim — tujuan bisa diganti untuk mengecek deliverability ke provider lain */}
          <form
            className="rounded-lg border border-border/40 bg-background/40 p-3 mb-3 space-y-2"
            onSubmit={(e) => { e.preventDefault(); notifCall('POST') }}
          >
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Kirim ke</label>
                <input
                  type="email" value={notifTo} onChange={(e) => setNotifTo(e.target.value)}
                  placeholder={diag?.config.target || 'vultype@gmail.com'}
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border/60 text-[12px] outline-none focus:border-primary/60"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Kosongkan = kirim ke {diag?.config.target || 'admin'}</p>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Catatan (opsional)</label>
                <input
                  value={notifNote} onChange={(e) => setNotifNote(e.target.value)} maxLength={300}
                  placeholder="mis. uji deliverability Gmail"
                  className="w-full h-9 px-2.5 rounded-md bg-background border border-border/60 text-[12px] outline-none focus:border-primary/60"
                />
              </div>
            </div>
            <Button type="submit" size="sm" className="gap-1.5 w-full sm:w-auto" disabled={notifBusy}>
              {notifBusy ? <><Loader2 size={13} className="animate-spin" /> Mengirim…</> : <><Bell size={13} /> Kirim Email Uji</>}
            </Button>
          </form>
          {!diag ? <p className="text-[11px] text-muted-foreground">Memuat status…</p> : (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground mb-1.5">Tujuan: <b className="text-foreground">{diag.config.target}</b></p>
              <Row ok={diag.config.resendKey} label="RESEND_API_KEY" detail={diag.config.resendKey ? 'Terpasang di environment' : 'Belum diset → email tidak akan terkirim (fallback ke Telegram)'} />
              <Row ok={!diag.config.usingDefaultFrom} label={`Pengirim: ${diag.config.resendFrom}`}
                detail={diag.config.usingDefaultFrom
                  ? 'Memakai domain bawaan resend.dev — HANYA bisa mengirim ke email pemilik akun Resend. Set RESEND_FROM dengan domain terverifikasi agar andal.'
                  : 'Memakai domain sendiri (terverifikasi di Resend)'} />
              <Row ok={diag.config.telegram} label="Telegram (cadangan)" detail={diag.config.telegram ? 'Terpasang — dipakai bila email gagal' : 'TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diset'} />
              {diag.result && (
                <div className="mt-3 pt-3 border-t border-border/40 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1">Hasil Pengiriman Uji</p>
                  <Row ok={diag.result.email.ok} label="Email (Resend)" detail={diag.result.email.detail} />
                  <Row ok={diag.result.telegram.ok} label="Telegram" detail={diag.result.telegram.detail} />
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><Bell size={12} /> Bunyi Notifikasi (chime regime)</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => playRegimeChime()}><Bell size={14} className="text-primary" /> Putar Bunyi</Button>
          <p className="text-[11px] text-muted-foreground/70 mt-1.5">Chime yang sama dipakai saat regime pasar berubah (Ranging ⇄ Trending) di terminal. Kalau tak terdengar di sini, cek volume perangkat/tab browser — bukan masalah kode.</p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2 flex items-center gap-1.5"><PartyPopper size={12} /> Popup Confetti</p>
          <Button size="sm" className="gap-1.5" onClick={fireConfetti}><PartyPopper size={14} /> Tembak Confetti</Button>
        </div>

        {confettiKey && <Confetti key={confettiKey} />}
      </CardContent>
    </Card>
  )
}

// ── Payment Gateway — pilih gateway aktif + kelola kredensial (secret tak pernah dikirim balik) ──
type GwCfg = {
  activeGateway: string
  doku: { clientId: string; secretKeyMask: string; production: boolean }
  ipaymu: { va: string; apiKeyMask: string; production: boolean }
  midtrans: { clientKey: string; serverKeyMask: string; production: boolean }
}
const GW_LIST = [
  { id: 'manual', label: 'Transfer Manual', note: 'Transfer bank + upload bukti · verifikasi admin' },
  { id: 'doku', label: 'DOKU', note: 'Redirect checkout · kartu, QRIS, e-wallet, VA' },
  { id: 'ipaymu', label: 'iPaymu', note: 'Redirect payment · QRIS, VA, retail, e-wallet' },
  { id: 'midtrans', label: 'Midtrans', note: 'Snap popup · kartu, QRIS, e-wallet, VA' },
] as const

function PaymentGatewayManager() {
  const [cfg, setCfg] = useState<GwCfg | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  // Input secret dibiarkan kosong = "jangan ubah". Server hanya menimpa bila diisi.
  const [dokuSecret, setDokuSecret] = useState('')
  const [ipaymuKey, setIpaymuKey] = useState('')
  const [midServer, setMidServer] = useState('')
  const [testing, setTesting] = useState(false)
  const [testRes, setTestRes] = useState<{ ok: boolean; message: string; mode?: string; endpoint?: string; va?: string; apiKey?: string; channels?: number } | null>(null)

  async function authFetch(init?: RequestInit) {
    const { data: { session } } = await createClient().auth.getSession()
    if (!session) throw new Error('Sesi habis, login ulang')
    return fetch('/api/admin/payment-config', { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init?.headers || {}) } })
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch()
        const j = await res.json()
        if (!res.ok) { if (j.needsMigration) setNeedsMigration(true); else toast.error(j.error || 'Gagal memuat'); setLoading(false); return }
        setCfg(j); setLoading(false)
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat'); setLoading(false) }
    })()
  }, [])

  async function save() {
    if (!cfg) return
    setSaving(true)
    try {
      const res = await authFetch({
        method: 'POST',
        body: JSON.stringify({
          activeGateway: cfg.activeGateway,
          doku: { clientId: cfg.doku.clientId, secretKey: dokuSecret, production: cfg.doku.production },
          ipaymu: { va: cfg.ipaymu.va, apiKey: ipaymuKey, production: cfg.ipaymu.production },
          midtrans: { clientKey: cfg.midtrans.clientKey, serverKey: midServer, production: cfg.midtrans.production },
        }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Gagal menyimpan'); setSaving(false); return }
      toast.success('Pengaturan pembayaran disimpan')
      setDokuSecret(''); setIpaymuKey(''); setMidServer('')
      const r2 = await authFetch(); if (r2.ok) setCfg(await r2.json())
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan') } finally { setSaving(false) }
  }

  // Tes kredensial TERSIMPAN ke iPaymu (endpoint baca-saja, tak membuat transaksi).
  async function testGateway(gateway: string) {
    setTesting(true); setTestRes(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      if (!session) { toast.error('Sesi habis, login ulang'); setTesting(false); return }
      const res = await fetch('/api/admin/payment-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ gateway }),
      })
      const j = await res.json()
      if (!res.ok) { toast.error(j.error || 'Gagal tes'); setTesting(false); return }
      setTestRes(j)
      if (j.ok) toast.success('Kredensial iPaymu valid'); else toast.error('Ditolak iPaymu: ' + j.message)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal tes') } finally { setTesting(false) }
  }

  if (needsMigration) return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet size={15} className="text-primary" /> Payment Gateway</CardTitle></CardHeader>
      <CardContent><MigrationBanner sql={`-- Jalankan isi file supabase-payment-config.sql
create table if not exists public.payment_config (
  id int primary key default 1 check (id = 1),
  active_gateway text not null default 'none',
  doku_client_id text, doku_secret_key text, doku_production boolean not null default false,
  ipaymu_va text, ipaymu_api_key text, ipaymu_production boolean not null default false,
  midtrans_server_key text, midtrans_client_key text, midtrans_production boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.payment_config (id) values (1) on conflict (id) do nothing;
alter table public.payment_config enable row level security;`} /></CardContent>
    </Card>
  )
  if (loading || !cfg) return <Card><CardContent className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={18} /></CardContent></Card>

  const set = (patch: Partial<GwCfg>) => setCfg(c => c ? { ...c, ...patch } : c)
  const secretField = (label: string, mask: string, val: string, onChange: (v: string) => void) => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input type="password" value={val} onChange={e => onChange(e.target.value)} placeholder={mask ? `Tersimpan (${mask}) — isi untuk ganti` : 'Belum diatur'}
        className={`${inp} mt-1`} autoComplete="new-password" />
      <p className="text-[11px] text-muted-foreground/70 mt-1">{mask ? 'Kosongkan bila tak ingin mengubah.' : 'Wajib diisi agar gateway ini bisa dipakai.'}</p>
    </div>
  )

  return (
    <>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wallet size={15} className="text-primary" /> Gateway Aktif</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Pilih SATU gateway yang dipakai di halaman checkout. Gateway lain tetap tersimpan kredensialnya (tinggal ganti kapan saja).</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <button onClick={() => set({ activeGateway: 'none' })} className={`text-left rounded-xl border p-3 transition-colors ${cfg.activeGateway === 'none' ? 'border-amber-500/40 bg-amber-500/[0.08]' : 'border-border/50 hover:border-white/25'}`}>
              <p className="text-sm font-bold">Nonaktif</p><p className="text-[11px] text-muted-foreground">Checkout menampilkan pesan “belum aktif”</p>
            </button>
            {GW_LIST.map(g => (
              <button key={g.id} onClick={() => set({ activeGateway: g.id })} className={`text-left rounded-xl border p-3 transition-colors ${cfg.activeGateway === g.id ? 'border-primary/50 bg-primary/[0.08]' : 'border-border/50 hover:border-white/25'}`}>
                <p className="text-sm font-bold flex items-center gap-2">{g.label}{cfg.activeGateway === g.id && <span className="text-[8px] font-bold uppercase rounded-full bg-primary/20 text-primary px-1.5 py-0.5">aktif</span>}</p>
                <p className="text-[11px] text-muted-foreground">{g.note}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">DOKU</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><label className="text-xs font-semibold text-muted-foreground">Client ID</label><input value={cfg.doku.clientId} onChange={e => set({ doku: { ...cfg.doku, clientId: e.target.value } })} className={`${inp} mt-1`} /></div>
          {secretField('Secret Key', cfg.doku.secretKeyMask, dokuSecret, setDokuSecret)}
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={cfg.doku.production} onChange={e => set({ doku: { ...cfg.doku, production: e.target.checked } })} /> Mode Produksi <span className="text-[11px] text-muted-foreground">(uncheck = sandbox)</span></label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">iPaymu</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><label className="text-xs font-semibold text-muted-foreground">VA (nomor Virtual Account merchant)</label><input value={cfg.ipaymu.va} onChange={e => set({ ipaymu: { ...cfg.ipaymu, va: e.target.value } })} placeholder="mis. 1179000899" className={`${inp} mt-1`} /></div>
          {secretField('API Key', cfg.ipaymu.apiKeyMask, ipaymuKey, setIpaymuKey)}
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={cfg.ipaymu.production} onChange={e => set({ ipaymu: { ...cfg.ipaymu, production: e.target.checked } })} /> Mode Produksi <span className="text-[11px] text-muted-foreground">(uncheck = sandbox)</span></label>
          {/* Tes kredensial tersimpan — endpoint baca-saja, tidak membuat transaksi */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => testGateway('ipaymu')} disabled={testing}>
              {testing ? <><Loader2 size={14} className="animate-spin" /> Menguji…</> : <><RefreshCw size={14} /> Test Koneksi</>}
            </Button>
            <span className="text-[11px] text-muted-foreground">Simpan dulu, baru tes. Tidak membuat transaksi.</span>
          </div>
          {testRes && (
            <div className={`rounded-xl border p-3 text-[12px] ${testRes.ok ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-300' : 'border-red-500/30 bg-red-500/[0.07] text-red-300'}`}>
              <p className="font-bold flex items-center gap-1.5">{testRes.ok ? <><CheckCircle2 size={13} /> Kredensial valid</> : <><XCircle size={13} /> Ditolak: {testRes.message}</>}</p>
              <p className="text-[11px] opacity-80 mt-1">Mode <b>{testRes.mode}</b> → {testRes.endpoint} · VA <b>{testRes.va}</b> · API Key <b>{testRes.apiKey}</b>{testRes.channels != null ? ` · ${testRes.channels} channel aktif` : ''}</p>
              {!testRes.ok && <p className="text-[11px] opacity-80 mt-1.5">Cek: VA &amp; API Key harus dari <b>mode yang sama</b> ({testRes.mode}). Kredensial sandbox ≠ produksi — ambil di dashboard iPaymu menu <b>Integrasi</b>.</p>}
            </div>
          )}
          <div className="rounded-xl bg-muted/30 border border-border/40 p-3">
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">Ambil VA & API Key di dashboard iPaymu → <strong>Integrasi</strong>. Set <strong>URL Notifikasi</strong> di iPaymu ke:</p>
            <code className="block rounded bg-black/40 border border-border/50 px-2 py-1.5 text-[11px] text-emerald-300 mt-1.5 overflow-x-auto">https://datalitiq.com/api/payment/ipaymu/notification</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Midtrans</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><label className="text-xs font-semibold text-muted-foreground">Client Key <span className="text-[10px] text-muted-foreground/60">(publik, dipakai di browser)</span></label><input value={cfg.midtrans.clientKey} onChange={e => set({ midtrans: { ...cfg.midtrans, clientKey: e.target.value } })} className={`${inp} mt-1`} /></div>
          {secretField('Server Key', cfg.midtrans.serverKeyMask, midServer, setMidServer)}
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={cfg.midtrans.production} onChange={e => set({ midtrans: { ...cfg.midtrans, production: e.target.checked } })} /> Mode Produksi <span className="text-[11px] text-muted-foreground">(uncheck = sandbox)</span></label>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="gap-1.5">{saving ? <><Loader2 size={14} className="animate-spin" /> Menyimpan…</> : 'Simpan Pengaturan Pembayaran'}</Button>
    </>
  )
}

// ── Verifikasi pembayaran manual (transfer bank) — bukti diunggah user, admin approve/tolak ──
type PayOrder = {
  id: string; user_id: string; plan: PlanId; months: number; total: number; unique_code: number
  status: string; invoice_number: string | null; proof_url: string | null; method: string; created_at: string
}
function PaymentVerificationManager({ users }: { users: AdminUser[] }) {
  const [orders, setOrders] = useState<PayOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const emailOf = (uid: string) => users.find(u => u.id === uid)?.email ?? uid.slice(0, 8)

  async function load() {
    setLoading(true)
    const { data } = await createClient().from('payment_orders').select('*')
      .in('status', ['menunggu_pembayaran', 'menunggu_verifikasi']).order('created_at', { ascending: false })
    setOrders((data ?? []) as PayOrder[])
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: 'aktif' | 'batal') {
    setBusyId(id)
    const { error } = await createClient().from('payment_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setBusyId(null)
    if (error) { toast.error('Gagal: ' + error.message); return }
    toast.success(status === 'aktif' ? 'Pesanan diaktifkan' : 'Pesanan ditolak')
    setOrders(os => os.filter(o => o.id !== id))
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Receipt size={15} className="text-primary" /> Verifikasi Pembayaran Manual</CardTitle>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg px-2.5 py-1 transition-colors"><RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary" size={18} /></div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Tidak ada pesanan menunggu verifikasi.</p>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="rounded-xl border border-border/50 bg-muted/20 p-3.5 flex flex-wrap items-center gap-3">
                {o.proof_url ? (
                  <a href={o.proof_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.proof_url} alt="Bukti transfer" className="w-16 h-16 rounded-lg object-cover border border-border/50 hover:opacity-80 transition-opacity" />
                  </a>
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-border/50 bg-muted/40 flex items-center justify-center shrink-0"><Clock size={18} className="text-muted-foreground/50" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold">{o.invoice_number ?? '—'}</span>
                    <Badge variant="outline" className={`text-[9px] ${o.status === 'menunggu_verifikasi' ? 'text-blue-400 border-blue-500/30' : 'text-amber-400 border-amber-500/30'}`}>{o.status === 'menunggu_verifikasi' ? 'Bukti diunggah' : 'Menunggu transfer'}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{emailOf(o.user_id)} · {planName(o.plan)} · {o.months} bln</p>
                  <p className="text-sm font-bold text-primary tabular-nums">{rp(o.total)} <span className="text-[10px] text-muted-foreground font-normal">(kode {o.unique_code})</span></p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {o.proof_url && <a href={o.proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center rounded-lg border border-border/50 p-2 text-muted-foreground hover:text-foreground transition-colors" title="Lihat bukti penuh"><ExternalLink size={14} /></a>}
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive" disabled={busyId === o.id} onClick={() => setStatus(o.id, 'batal')}><XCircle size={13} /> Tolak</Button>
                  <Button size="sm" className="gap-1.5" disabled={busyId === o.id} onClick={() => setStatus(o.id, 'aktif')}>{busyId === o.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Aktifkan</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

type AdminUser = { id: string; email: string; created_at: string; last_sign_in_at: string | null }
type PayRow = { user_id: string; plan: string; months: number; total: number; status: string; method: string | null; created_at: string; updated_at: string | null }

type UserRow = {
  id: string; email: string; created_at: string; lastLogin: string | null
  trades: number; wins: number; losses: number; pnl: number
  deposited: number; withdrawn: number; lastActive: string | null
  // langganan
  sub: 'pro' | 'expired' | 'none'; expiresAt: Date | null; daysLeft: number | null
  plan: string | null; paid: number; lastMethod: string | null
}

export default function AdminPage() {
  const sub = useSubscription()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [trades, setTrades]   = useState<Trade[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [orders, setOrders]   = useState<PayRow[]>([])
  const [journalCount, setJournalCount] = useState(0)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'users' | 'content' | 'marketing' | 'seo' | 'publikasi' | 'dev' | 'bayar' | 'email'>('users')

  useEffect(() => {
    if (!sub.loading && !sub.isAdmin) router.replace('/hub')
  }, [sub.loading, sub.isAdmin, router])

  async function load() {
    setLoading(true); setError(null)
    const sb = createClient()
    const [u, t, x, j, o] = await Promise.all([
      sb.rpc('admin_all_users'),
      sb.from('trades').select('*'),
      sb.from('transfers').select('*'),
      sb.from('journal_notes').select('id'),
      sb.from('payment_orders').select('user_id, plan, months, total, status, method, created_at, updated_at'),
    ])
    if (u.error) {
      setError(`Fungsi admin belum di-setup di Supabase. Jalankan file SQL admin (admin_all_users + admin policies). Detail: ${u.error.message}`)
      setLoading(false); return
    }
    setUsers((u.data ?? []) as AdminUser[])
    setTrades((t.data ?? []) as Trade[])
    setTransfers((x.data ?? []) as Transfer[])
    setJournalCount((j.data ?? []).length)
    setOrders((o.data ?? []) as PayRow[])
    setLoading(false)
  }

  useEffect(() => { if (sub.isAdmin) load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sub.isAdmin])

  const rows = useMemo<UserRow[]>(() => {
    return users.map(u => {
      const ut = trades.filter(t => (t as Trade & { user_id: string }).user_id === u.id)
      const norm = ut.filter(t => !t.is_overtrade)
      const wins = norm.filter(t => t.result === 'win').length
      const losses = norm.filter(t => t.result === 'loss').length
      const pnl = ut.reduce((s, t) => s + Number(t.pnl), 0)
      const ux = transfers.filter(t => (t as Transfer & { user_id: string }).user_id === u.id)
      const deposited = ux.filter(t => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0)
      const withdrawn = ux.filter(t => t.type === 'withdraw').reduce((s, t) => s + Number(t.amount), 0)
      const lastActive = ut.length > 0 ? ut.map(t => t.date).sort().at(-1) ?? null : null
      // langganan: order 'aktif' terbaru + total yang dibayar
      const myOrders = orders.filter(o => o.user_id === u.id)
      const paid = myOrders.filter(o => o.status === 'aktif').reduce((s, o) => s + Number(o.total), 0)
      const active = myOrders.filter(o => o.status === 'aktif').sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())[0]
      let subStatus: UserRow['sub'] = 'none', expiresAt: Date | null = null, daysLeft: number | null = null, plan: string | null = null, lastMethod: string | null = null
      if (active) {
        plan = active.plan; lastMethod = active.method
        expiresAt = addMonths(new Date(active.updated_at || active.created_at), active.months || 1)
        daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
        subStatus = daysLeft >= 0 ? 'pro' : 'expired'
      }
      return { id: u.id, email: u.email, created_at: u.created_at, lastLogin: u.last_sign_in_at, trades: ut.length, wins, losses, pnl, deposited, withdrawn, lastActive, sub: subStatus, expiresAt, daysLeft, plan, paid, lastMethod }
    }).sort((a, b) => (b.sub === 'pro' ? 1 : 0) - (a.sub === 'pro' ? 1 : 0) || b.paid - a.paid || b.trades - a.trades)
  }, [users, trades, transfers, orders])

  const filtered = q.trim() ? rows.filter(r => r.email.toLowerCase().includes(q.trim().toLowerCase())) : rows
  const activeSubs = rows.filter(r => r.sub === 'pro').length
  const revenue = orders.filter(o => o.status === 'aktif').reduce((s, o) => s + Number(o.total), 0)

  if (sub.loading || !sub.isAdmin) {
    return <div className="min-h-screen bg-[#060a09] flex justify-center items-center"><Loader2 className="animate-spin text-primary" /></div>
  }

  const subBadge = (r: UserRow) => r.sub === 'pro'
    ? <Badge className="text-[9px] bg-primary/15 text-primary border-primary/25" variant="outline">PRO</Badge>
    : r.sub === 'expired' ? <Badge className="text-[9px] bg-red-500/15 text-red-400 border-red-500/25" variant="outline">EXPIRED</Badge>
    : <Badge className="text-[9px] bg-white/5 text-muted-foreground border-border/50" variant="outline">FREE</Badge>

  return (
    <div className="min-h-screen bg-[#060a09] text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[360px] bg-red-500/8 blur-[150px] rounded-full pointer-events-none" />
      <header className="relative max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/hub" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Ke Hub</Link>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          <button onClick={async () => { await createClient().auth.signOut(); router.replace('/login') }} className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white px-2 py-1.5 transition-colors"><LogOut size={14} /></button>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-5 pt-6 pb-20">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="p-2.5 rounded-xl bg-red-500/10 ring-1 ring-red-500/20"><Shield size={20} className="text-red-400" /></span>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Panel Admin · CMS</h1>
            <p className="text-sm text-white/50">Kelola pengguna, langganan, konten & branding</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3 mb-6">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm"><p className="font-semibold text-red-400">Setup admin belum lengkap</p><p className="text-white/50 mt-1 leading-relaxed">{error}</p></div>
          </div>
        )}

        {/* Ringkasan */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total User', value: String(users.length), icon: Users, color: 'text-blue-400' },
            { label: 'Pelanggan Pro', value: String(activeSubs), icon: Crown, color: 'text-primary' },
            { label: 'Pendapatan', value: fmt(revenue), icon: Wallet, color: 'text-emerald-400' },
            { label: 'Total Trade', value: String(trades.length), icon: TrendingUp, color: 'text-cyan-400' },
            { label: 'Total Jurnal', value: String(journalCount), icon: Activity, color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
              <div className="flex items-center gap-1.5 mb-1"><s.icon size={12} className={s.color} /><p className="text-[11px] text-white/45">{s.label}</p></div>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab('users')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'users' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Pengguna & Langganan</button>
          <button onClick={() => setTab('content')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'content' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Konten & Branding</button>
          <button onClick={() => setTab('marketing')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'marketing' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Marketing & Iklan</button>
          <button onClick={() => setTab('seo')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'seo' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>SEO & Analytics</button>
          <button onClick={() => setTab('publikasi')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'publikasi' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Outlook & Blog</button>
          <button onClick={() => setTab('bayar')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'bayar' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Pembayaran</button>
          <button onClick={() => setTab('email')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'email' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Email</button>
          <button onClick={() => setTab('dev')} className={`text-sm font-semibold rounded-lg px-4 py-2 transition-colors ${tab === 'dev' ? 'bg-primary text-primary-foreground' : 'border border-white/15 text-white/70 hover:bg-white/5'}`}>Dev Tools</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
        ) : tab === 'users' ? (
          <div className="space-y-6">
            {/* Pesanan menunggu aktivasi */}
            <ManualProGrant users={users} onGranted={load} />
            <div className="[&_.text-primary]:text-primary"><PaymentVerificationManager users={users} /></div>

            {/* Tabel user + langganan */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.06]">
                <p className="text-sm font-bold">Pengguna & Langganan <span className="text-white/40 font-normal">({filtered.length})</span></p>
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari email…" className="w-48 rounded-lg border border-white/10 bg-black/20 pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-primary/40" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[11px] text-white/40">
                      {['Pengguna', 'Langganan', 'Kadaluarsa', 'Login Terakhir', 'Dibayar', 'Trades', 'P&L', 'Trade Terakhir'].map((h, i) => (
                        <th key={h} className={`px-3 py-2.5 font-semibold ${i === 0 ? 'text-left' : i === 1 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map(r => (
                      <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.email}</span>
                            {r.id === sub.userId && <Badge className="text-[9px] bg-red-500/15 text-red-400 border-red-500/20" variant="outline">ADMIN</Badge>}
                          </div>
                          <p className="text-[10px] text-white/35">Bergabung {r.created_at?.slice(0, 10)}</p>
                        </td>
                        <td className="px-3 py-3">{subBadge(r)}{r.lastMethod && r.sub !== 'none' && <span className="ml-1.5 text-[10px] text-white/35 uppercase">{r.lastMethod}</span>}</td>
                        <td className="px-3 py-3 text-right text-xs">{r.sub === 'none' ? <span className="text-white/30">—</span> : <span className={r.daysLeft != null && r.daysLeft < 7 ? (r.daysLeft < 0 ? 'text-red-400' : 'text-amber-400') : 'text-white/70'}>{fmtDate(r.expiresAt)}{r.daysLeft != null && r.daysLeft >= 0 ? <span className="text-white/35"> ({r.daysLeft}h)</span> : ''}</span>}</td>
                        <td className="px-3 py-3 text-right text-xs">{r.lastLogin ? <span className="text-white/60">{fmtLoginRel(r.lastLogin)}</span> : <span className="text-amber-400/70" title="Daftar tapi belum pernah login">belum login</span>}</td>
                        <td className="px-3 py-3 text-right font-semibold text-emerald-400">{r.paid > 0 ? fmt(r.paid) : <span className="text-white/30">—</span>}</td>
                        <td className="px-3 py-3 text-right">{r.trades}</td>
                        <td className={`px-3 py-3 text-right font-bold ${r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.pnl !== 0 ? `${r.pnl >= 0 ? '+' : ''}${fmt(r.pnl)}` : <span className="text-white/30">—</span>}</td>
                        <td className="px-3 py-3 text-right text-xs text-white/45">{r.lastActive ?? '—'}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-white/40">Tidak ada pengguna.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : tab === 'content' ? (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <LogoManager />
            <LoginImageManager />
            <ClientLogosManager />
            <PaymentLogosManager />
            <FeatureImagesManager />
          </div>
        ) : tab === 'marketing' ? (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <MetaPixelManager />
          </div>
        ) : tab === 'seo' ? (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <SeoManager />
          </div>
        ) : tab === 'bayar' ? (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <PaymentGatewayManager />
          </div>
        ) : tab === 'email' ? (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <EmailManager users={rows} />
          </div>
        ) : tab === 'publikasi' ? (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <DailyOutlookManager />
            <BlogManager />
          </div>
        ) : (
          <div className="space-y-6 [&_.bg-card]:bg-white/[0.02] [&_.text-card-foreground]:text-white">
            <DevToolsManager />
          </div>
        )}
      </main>
    </div>
  )
}
