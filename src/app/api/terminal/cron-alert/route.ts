import { NextResponse } from 'next/server'
import { fetchCandles, fetchQuote } from '@/lib/twelvedata'
import { fetchMacro, type MacroPoint } from '@/lib/fred'
import { computeTF, riskOnScore, scores, confluence, regimeOf, efficiencyRatio, adxLabel, usMarketOpen, type TF, type TFData, type CrossQuote } from '@/lib/terminal-signal'
import { sendTelegram, telegramConfigured } from '@/lib/telegram'
import { getAlertState, setAlertState, alertStateConfigured, logPrediction, evaluateDuePredictions, type AlertState } from '@/lib/alert-state'

// ─────────────────────────────────────────────────────────────────────────
// CRON NOTIFIKASI TELEGRAM — dipanggil berkala (mis. cron-job.org tiap 5 menit).
// Hitung ulang regime & confidence pakai lib SAMA dengan dashboard, lalu kirim
// notif Telegram HANYA saat kondisi BERUBAH (edge-triggered):
//   1) Regime baru masuk "Trending"        → notif + % confidence
//   2) "Layak masuk": Trending + confidence ≥66% + 3 TF (M5/M15/H1) searah
// Dijaga CRON_SECRET. State disimpan di Supabase supaya tidak spam.
// ─────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const CONF_MIN = 66            // ambang confidence "layak masuk"
const TRENDING_COOLDOWN = 60 * 60_000   // jangan ulang notif Trending dalam 60 mnt
const LAYAK_COOLDOWN = 45 * 60_000      // jangan ulang notif "layak masuk" arah sama dalam 45 mnt

const CROSS_SYMBOLS = 'BTC/USD,SPY,QQQ,VIXY,XAG/USD'
const NEWS_GUARD_MS = 30 * 60_000 // News Guard: ±30 menit di sekitar rilis USD berdampak tinggi

// Cek apakah SEKARANG berada dalam jendela rilis USD High-impact (ForexFactory mingguan).
async function newsGuardActive(now: number): Promise<{ active: boolean; event?: string; minutes?: number }> {
  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0 (DatalitiqTerminal)' } })
    if (!res.ok) return { active: false }
    const j = (await res.json()) as { title?: string; country?: string; date?: string; impact?: string }[]
    for (const e of j) {
      if (e.country !== 'USD' || e.impact !== 'High' || !e.date) continue
      const t = new Date(e.date).getTime()
      if (Number.isFinite(t) && Math.abs(now - t) <= NEWS_GUARD_MS) {
        return { active: true, event: e.title, minutes: Math.round((t - now) / 60_000) }
      }
    }
    return { active: false }
  } catch { return { active: false } } // kalender gagal → jangan blokir alert
}

async function fetchCross(): Promise<{ spy: CrossQuote; qqq: CrossQuote; vixy: CrossQuote; btc: CrossQuote }> {
  const key = process.env.TWELVE_DATA_API_KEY
  if (!key) return { spy: null, qqq: null, vixy: null, btc: null }
  try {
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(CROSS_SYMBOLS)}&apikey=${key}`, { cache: 'no-store' })
    const j = await res.json()
    if (j.status === 'error' || j.code) return { spy: null, qqq: null, vixy: null, btc: null }
    const q = (sym: string): CrossQuote => {
      const v = j[sym] as { close?: string; percent_change?: string } | undefined
      return v?.close ? { price: parseFloat(v.close), changePct: parseFloat(v.percent_change ?? '0') } : null
    }
    return { spy: q('SPY'), qqq: q('QQQ'), vixy: q('VIXY'), btc: q('BTC/USD') }
  } catch { return { spy: null, qqq: null, vixy: null, btc: null } }
}

const dirWord = (d: string) => d === 'BULLISH' ? 'BELI (naik)' : d === 'BEARISH' ? 'JUAL (turun)' : 'Netral'
const emoji = (d: string) => d === 'BULLISH' ? '🟢' : d === 'BEARISH' ? '🔴' : '⚪️'

function fmtTrending(o: { price: number; conf: number; dir: string; adx: number; desc: string; conflu: string; zone: string }): string {
  return [
    `${emoji(o.dir)} <b>TRENDING terbentuk — XAU/USD</b>`,
    ``,
    `Harga: <b>$${o.price.toFixed(2)}</b>`,
    `Arah bias: <b>${dirWord(o.dir)}</b>`,
    `Confidence: <b>${o.conf}%</b>`,
    `ADX: <b>${o.adx.toFixed(0)}</b> (${adxLabel(o.adx)}) · ${o.desc}`,
    `Konfluensi 3 TF: ${o.conflu}`,
    `Area pullback: <b>${o.zone}</b>`,
    ``,
    `<i>Pasar mulai bergerak searah. Tunggu harga kembali ke area pullback di atas, konfirmasi, baru entry. Selalu pasang stop.</i>`,
  ].join('\n')
}

function fmtLayak(o: { price: number; conf: number; dir: string; adx: number; tf: string }): string {
  return [
    `${emoji(o.dir)}🔥 <b>LAYAK MASUK — XAU/USD</b>`,
    ``,
    `Setup high-conviction terpenuhi:`,
    `• Regime: <b>Trending</b>`,
    `• Confidence: <b>${o.conf}%</b> (≥${CONF_MIN}%)`,
    `• 3 timeframe SEARAH: ${o.tf}`,
    ``,
    `Harga: <b>$${o.price.toFixed(2)}</b>`,
    `Aksi: <b>${dirWord(o.dir)}</b> · ADX ${o.adx.toFixed(0)}`,
    ``,
    `<i>Sinyal paling bersih. Tetap kelola risiko & pasang stop loss.</i>`,
  ].join('\n')
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const provided = url.searchParams.get('key') || req.headers.get('x-cron-key') || ''
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET belum diset' }, { status: 503 })
  if (provided !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!telegramConfigured()) return NextResponse.json({ error: 'Telegram belum dikonfigurasi (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)' }, { status: 503 })
  if (!alertStateConfigured()) return NextResponse.json({ error: 'State store belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY)' }, { status: 503 })

  try {
    // 1) Ambil semua data real paralel
    const [m5, m15, h1, quote, macroArr, cross] = await Promise.all([
      fetchCandles('M5'), fetchCandles('M15'), fetchCandles('H1'),
      fetchQuote().catch(() => null),
      fetchMacro().catch((): MacroPoint[] => []),
      fetchCross(),
    ])
    if (!m5.length || !m15.length || !h1.length) throw new Error('candle kosong dari Twelve Data')

    // 2) Hitung sinyal — sama persis dengan dashboard (volume placeholder = 1, seperti UI)
    const toCandles = (arr: { o: number; h: number; l: number; c: number; t: number }[]) => arr.map(c => ({ ...c, v: 1 }))
    const tf: Record<TF, TFData> = { M5: computeTF(toCandles(m5)), M15: computeTF(toCandles(m15)), H1: computeTF(toCandles(h1)) }
    const macro = macroArr.length ? Object.fromEntries(macroArr.map(p => [p.key, p])) : null
    const now = Date.now()
    const usOpen = usMarketOpen(now)
    const riskOn = riskOnScore(cross, usOpen)
    const sc = scores(tf, macro, null, riskOn)   // newsScore null → senti dari risk-on (sama dgn dashboard saat AI belum jalan)
    const conf = confluence(tf)
    const adx = tf.M15.adx
    const trendUp = tf.M15.plusDI >= tf.M15.minusDI
    const regime = regimeOf({
      bbSqueeze: tf.M15.boll.squeeze, adx, adxTrend: tf.M15.adxTrend, trendUp,
      er: efficiencyRatio(tf.M15.candles.map(c => c.c), 14),
      diSpread: Math.abs(tf.M15.plusDI - tf.M15.minusDI),
      m5: { adx: tf.M5.adx, trendUp: tf.M5.plusDI >= tf.M5.minusDI },
      h1: { adx: tf.H1.adx, trendUp: tf.H1.plusDI >= tf.H1.minusDI },
    })
    const price = quote?.price ?? tf.M5.candles[tf.M5.candles.length - 1].c

    // #7 guard pasar tutup: candle M5 terbaru lebih tua dari 15 menit → jangan kirim alert dari data mati
    const lastCandleT = m5.length ? m5[m5.length - 1].t : 0
    if (lastCandleT && now - lastCandleT > 15 * 60_000) {
      return NextResponse.json({ ok: true, skipped: 'market_closed', ageMin: Math.round((now - lastCandleT) / 60_000) })
    }

    // #8 kalibrasi: catat kesimpulan sekarang + evaluasi kesimpulan lama (gagal-diam bila tabel belum ada)
    await logPrediction({ dir: sc.label, confidence: sc.confidence, price, regime: regime.label })
    await evaluateDuePredictions(price)

    // News Guard: di sekitar rilis USD berdampak tinggi, TAHAN alert (kalibrasi tetap dicatat).
    // State sengaja TIDAK di-update supaya rising-edge trending tetap terkirim setelah guard lewat.
    const guard = await newsGuardActive(now)
    if (guard.active) {
      return NextResponse.json({ ok: true, skipped: 'news_guard', event: guard.event, minutes: guard.minutes, regime: regime.label, confidence: sc.confidence })
    }

    const trending = regime.phase === 'trending'
    const layak = trending && sc.confidence >= CONF_MIN && conf.strength === 'kuat'
    const layakDir = conf.label === 'BULLISH' || conf.label === 'BEARISH' ? conf.label : null
    const tfWord = `M5 ${tf.M5.bias.label} · M15 ${tf.M15.bias.label} · H1 ${tf.H1.bias.label}`

    // 3) State sebelumnya
    const prev: AlertState = (await getAlertState()) ?? {}
    const sent: string[] = []

    // Run pertama (belum ada state): kirim konfirmasi aktif + seed, jangan blast sinyal lama
    if (!prev.seededAt) {
      await sendTelegram([
        `✅ <b>Notifikasi Datalitiq aktif</b>`,
        ``,
        `Mulai sekarang kamu akan dapat notif saat XAU/USD masuk <b>Trending</b> & saat setup <b>layak masuk</b> (high conviction).`,
        ``,
        `Kondisi saat ini: <b>${regime.label}</b> · Confidence ${sc.confidence}% · Harga $${price.toFixed(2)}`,
      ].join('\n'))
      await setAlertState({ lastRegime: regime.label, trendingActive: trending, lastTrendingAt: trending ? now : undefined, layakActive: layak, lastLayakAt: layak ? now : undefined, lastLayakDir: layakDir ?? undefined, seededAt: now })
      return NextResponse.json({ ok: true, seeded: true, regime: regime.label, confidence: sc.confidence })
    }

    const next: AlertState = { ...prev, lastRegime: regime.label }

    // 4a) Notif TRENDING — rising edge + cooldown
    if (trending && !prev.trendingActive && (now - (prev.lastTrendingAt ?? 0) > TRENDING_COOLDOWN)) {
      // Zona pullback = HARGA konkret (EMA21 & rata-rata sesi M15), bukan nama indikator
      const e21 = tf.M15.ema21[tf.M15.ema21.length - 1]
      const zLo = Math.min(e21, tf.M15.vwap), zHi = Math.max(e21, tf.M15.vwap)
      const zone = zHi - zLo < 1 ? `$${((zLo + zHi) / 2).toFixed(2)}` : `$${zLo.toFixed(2)}–$${zHi.toFixed(2)}`
      const r = await sendTelegram(fmtTrending({ price, conf: sc.confidence, dir: sc.label, adx, desc: regime.desc, conflu: `${conf.bulls} bull / ${conf.bears} bear (${conf.strength})`, zone }))
      if (r.ok) { sent.push('trending'); next.lastTrendingAt = now }
    }
    next.trendingActive = trending

    // 4b) Notif LAYAK MASUK — rising edge / arah berganti + cooldown per arah
    const layakEdge = layak && (!prev.layakActive || prev.lastLayakDir !== layakDir)
    const layakCooldownOk = prev.lastLayakDir === layakDir ? (now - (prev.lastLayakAt ?? 0) > LAYAK_COOLDOWN) : true
    if (layakEdge && layakCooldownOk && layakDir) {
      const r = await sendTelegram(fmtLayak({ price, conf: sc.confidence, dir: layakDir, adx, tf: tfWord }))
      if (r.ok) { sent.push('layak'); next.lastLayakAt = now; next.lastLayakDir = layakDir }
    }
    next.layakActive = layak

    await setAlertState(next)
    return NextResponse.json({ ok: true, sent, regime: regime.label, confidence: sc.confidence, trending, layak, dir: sc.label, adx: +adx.toFixed(1) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal' }, { status: 502 })
  }
}
