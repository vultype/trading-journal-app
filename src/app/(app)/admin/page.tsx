'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { useCurrency } from '@/hooks/useCurrency'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { toast } from '@/lib/toast'
import { Shield, Users, TrendingUp, Activity, Loader2, AlertTriangle, RefreshCw, ImageIcon, Upload, Trash2, Info, Receipt, CheckCircle2, XCircle, ExternalLink, Clock } from 'lucide-react'
import { rp, planName, type PlanId } from '@/lib/pricing'
import type { Trade, Transfer } from '@/types'

function LogoManager() {
  const { logoUrl, updateLogo } = useStore()
  const [uploading, setUploading] = useState(false)

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
      updateLogo(data.publicUrl)
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

// ── Gambar fitur homepage (section "Satu Terminal. Semua yang Institusi Punya.") ──
// Disimpan di app_config.feature_images (jsonb: { key: url }), upload ke bucket yang sama.
const FEATURE_SLOTS: { key: string; label: string }[] = [
  { key: 'gauge', label: 'Bias Harian Jelas' },
  { key: 'decision', label: 'Keputusan AI' },
  { key: 'macro', label: 'Makro Real-Time' },
  { key: 'sentiment', label: 'Posisi Institusi' },
  { key: 'chat', label: 'Tanya AI' },
  { key: 'notif', label: 'Alert Telegram' },
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

type AdminUser = { id: string; email: string; created_at: string }

type UserRow = {
  id: string
  email: string
  created_at: string
  trades: number
  wins: number
  losses: number
  pnl: number
  deposited: number
  withdrawn: number
  lastActive: string | null
}

export default function AdminPage() {
  const { isAdmin, loading: storeLoading } = useStore()
  const fmt = useCurrency()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [users, setUsers]     = useState<AdminUser[]>([])
  const [trades, setTrades]   = useState<Trade[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [journalCount, setJournalCount] = useState(0)

  useEffect(() => {
    if (!storeLoading && !isAdmin) router.replace('/jurnal')
  }, [storeLoading, isAdmin, router])

  async function load() {
    setLoading(true); setError(null)
    const sb = createClient()
    const [u, t, x, j] = await Promise.all([
      sb.rpc('admin_all_users'),
      sb.from('trades').select('*'),
      sb.from('transfers').select('*'),
      sb.from('journal_notes').select('id'),
    ])

    if (u.error) {
      setError(`Fungsi admin belum di-setup di Supabase. Jalankan file SQL admin (admin_all_users + admin policies). Detail: ${u.error.message}`)
      setLoading(false)
      return
    }
    setUsers((u.data ?? []) as AdminUser[])
    setTrades((t.data ?? []) as Trade[])
    setTransfers((x.data ?? []) as Transfer[])
    setJournalCount((j.data ?? []).length)
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

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
      return { id: u.id, email: u.email, created_at: u.created_at, trades: ut.length, wins, losses, pnl, deposited, withdrawn, lastActive }
    }).sort((a, b) => b.trades - a.trades)
  }, [users, trades, transfers])

  const totalPnl = trades.reduce((s, t) => s + Number(t.pnl), 0)

  if (storeLoading || !isAdmin) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-red-500/10"><Shield size={18} className="text-red-400" /></span>
          <div>
            <h1 className="text-xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Aktivitas seluruh pengguna aplikasi</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Pembayaran manual */}
      <PaymentVerificationManager users={users} />

      {/* Logo / branding */}
      <LogoManager />
      <ClientLogosManager />
      <PaymentLogosManager />
      <FeatureImagesManager />

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-red-400">Setup admin belum lengkap</p>
              <p className="text-muted-foreground mt-1 leading-relaxed">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" /></div>
      ) : !error && (
        <>
          {/* Aggregate stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total User', value: String(users.length), icon: Users, color: 'text-blue-400' },
              { label: 'Total Trade', value: String(trades.length), icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'Total Jurnal', value: String(journalCount), icon: Activity, color: 'text-purple-400' },
              { label: 'Total P&L (semua)', value: fmt(totalPnl), icon: Activity, color: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={12} className={s.color} />
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* User table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daftar Pengguna</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 text-[11px] text-muted-foreground">
                      {['Email', 'Trades', 'W/L', 'P&L', 'Deposit', 'Withdraw', 'Aktivitas Terakhir'].map((h, i) => (
                        <th key={h} className={`px-3 py-3 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {rows.map(r => (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{r.email}</span>
                            {r.email === 'vultype@gmail.com' && <Badge className="text-[9px] bg-red-500/15 text-red-400 border-red-500/20" variant="outline">ADMIN</Badge>}
                          </div>
                          <p className="text-[10px] text-muted-foreground/50">Bergabung {r.created_at?.slice(0, 10)}</p>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">{r.trades}</td>
                        <td className="px-3 py-3 text-right text-xs">
                          <span className="text-emerald-400">{r.wins}</span>
                          <span className="text-muted-foreground/40"> / </span>
                          <span className="text-red-400">{r.losses}</span>
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${r.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {r.pnl >= 0 ? '+' : ''}{fmt(r.pnl)}
                        </td>
                        <td className="px-3 py-3 text-right text-indigo-400">{r.deposited > 0 ? fmt(r.deposited) : '—'}</td>
                        <td className="px-3 py-3 text-right text-violet-400">{r.withdrawn > 0 ? fmt(r.withdrawn) : '—'}</td>
                        <td className="px-3 py-3 text-right text-xs text-muted-foreground">{r.lastActive ?? '—'}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">Belum ada pengguna lain.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
