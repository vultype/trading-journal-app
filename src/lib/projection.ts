// ═══════════════════════════════════════════════════════════════════════════
// PROYEKSI LEVEL — "harga menuju ke mana, target sampai mana, koreksi sampai mana"
//
// PENTING soal framing: ini BUKAN prediksi. Tidak ada yang bisa memastikan arah
// harga. Yang dihitung di sini adalah LEVEL TERUKUR dari price action — tempat
// harga secara historis cenderung bereaksi:
//   - Target   : proyeksi Fibonacci extension dari leg impuls + swing sebelumnya
//   - Koreksi  : retracement Fib 38.2/50/61.8/78.6 dari leg yang sama
//   - Batal    : level yang bila tertembus membuat skenario tidak berlaku lagi
//   - Ruang    : berapa banyak range harian yang sudah terpakai (sisa tenaga)
//
// Semua angka diturunkan dari swing dan ATR nyata — tidak ada angka karangan.
// ═══════════════════════════════════════════════════════════════════════════
import type { Candle } from './terminal-signal'

export type ProjDir = 'naik' | 'turun' | 'netral'

export type ProjLevel = {
  label: string
  price: number
  basis: string        // dari mana angkanya — supaya bisa diaudit, bukan kotak hitam
  distPct: number      // jarak dari harga sekarang (%)
  reached: boolean     // sudah tersentuh?
}

export type Projection = {
  dir: ProjDir
  dirNote: string
  legLo: number
  legHi: number
  targets: ProjLevel[]
  retracements: ProjLevel[]
  invalidation: { price: number; note: string } | null
  room: { usedPct: number; todayRange: number; typical: number; note: string } | null
  note: string
}

// Swing pivot fractal — bar terakhir yang belum final dikecualikan.
function pivots(c: Candle[], left = 2, right = 2) {
  const conf = c.slice(0, -right)
  const highs: number[] = [], lows: number[] = []
  for (let i = left; i < conf.length - right; i++) {
    const win = conf.slice(i - left, i + right + 1)
    if (conf[i].h === Math.max(...win.map(x => x.h))) highs.push(conf[i].h)
    if (conf[i].l === Math.min(...win.map(x => x.l))) lows.push(conf[i].l)
  }
  return { highs, lows }
}

// Range harian rata-rata dari candle H1 (dikelompokkan per tanggal UTC).
// Dipakai untuk menjawab "masih ada ruang gerak hari ini atau sudah habis?"
function dailyRanges(h1: Candle[]): number[] {
  const byDay = new Map<string, { hi: number; lo: number }>()
  for (const k of h1) {
    const d = new Date(k.t).toISOString().slice(0, 10)
    const cur = byDay.get(d)
    if (!cur) byDay.set(d, { hi: k.h, lo: k.l })
    else { cur.hi = Math.max(cur.hi, k.h); cur.lo = Math.min(cur.lo, k.l) }
  }
  return [...byDay.values()].map(v => v.hi - v.lo).filter(v => v > 0)
}

export type ProjInput = {
  m15: Candle[]
  h1: Candle[]
  price: number
  ema21: number
  atr: number
  dayHigh: number
  dayLow: number
}

export function buildProjection(inp: ProjInput): Projection {
  const { m15, h1, price, ema21, atr, dayHigh, dayLow } = inp
  const empty: Projection = {
    dir: 'netral', dirNote: 'Struktur belum jelas — proyeksi belum bisa dihitung.',
    legLo: 0, legHi: 0, targets: [], retracements: [], invalidation: null, room: null,
    note: 'Butuh swing yang terbentuk untuk menghitung proyeksi.',
  }
  if (m15.length < 30) return empty

  const { highs, lows } = pivots(m15)
  if (!highs.length || !lows.length) return empty
  const lastHigh = highs[highs.length - 1]
  const lastLow = lows[lows.length - 1]
  if (!(lastHigh > lastLow)) return empty

  const range = lastHigh - lastLow
  if (range <= 0) return empty

  // Arah leg impuls: mana yang terbentuk BELAKANGAN — high atau low?
  // Kalau high yang terakhir & harga di atas EMA21 → leg naik (koreksi = turun).
  const hIdx = m15.map(x => x.h).lastIndexOf(lastHigh)
  const lIdx = m15.map(x => x.l).lastIndexOf(lastLow)
  const legUp = hIdx > lIdx
  const aboveEma = price > ema21
  // Arah dinyatakan netral bila leg dan posisi terhadap EMA saling bertentangan —
  // lebih jujur daripada memaksakan satu arah saat buktinya campur.
  const dir: ProjDir = legUp === aboveEma ? (legUp ? 'naik' : 'turun') : 'netral'

  const pct = (p: number) => ((p - price) / price) * 100
  const mkT = (label: string, p: number, basis: string): ProjLevel => ({
    label, price: p, basis, distPct: pct(p),
    reached: legUp ? price >= p : price <= p,
  })

  // ── TARGET: proyeksi searah leg ──
  const targets: ProjLevel[] = []
  if (legUp) {
    targets.push(mkT('Swing', lastHigh, 'puncak swing terakhir — uji ulang pertama'))
    targets.push(mkT('Ext 1.272', lastLow + range * 1.272, 'Fibonacci extension leg impuls'))
    targets.push(mkT('Ext 1.618', lastLow + range * 1.618, 'Fibonacci extension leg impuls'))
  } else {
    targets.push(mkT('Swing', lastLow, 'dasar swing terakhir — uji ulang pertama'))
    targets.push(mkT('Ext 1.272', lastHigh - range * 1.272, 'Fibonacci extension leg impuls'))
    targets.push(mkT('Ext 1.618', lastHigh - range * 1.618, 'Fibonacci extension leg impuls'))
  }

  // ── KOREKSI: sampai mana pullback masih wajar ──
  const rLvl = (r: number) => (legUp ? lastHigh - range * r : lastLow + range * r)
  const retDefs: [string, number, string][] = [
    ['38.2%', 0.382, 'koreksi dangkal — tren masih kuat'],
    ['50%', 0.5, 'koreksi normal'],
    ['61.8%', 0.618, 'batas golden zone — masih sehat'],
    ['78.6%', 0.786, 'koreksi dalam — tren mulai diragukan'],
  ]
  // Posisi retracement harga saat ini (0 = belum koreksi, 1 = balik penuh)
  const retNow = legUp ? (lastHigh - price) / range : (price - lastLow) / range
  const retracements: ProjLevel[] = retDefs.map(([label, r, note]) => ({
    label, price: rLvl(r), basis: note, distPct: pct(rLvl(r)),
    reached: retNow >= r,
  }))

  // ── BATAL: tembus swing awal = struktur leg rusak ──
  const invPrice = legUp ? lastLow : lastHigh
  const invalidation = {
    price: invPrice,
    note: legUp
      ? `Tembus di bawah $${invPrice.toFixed(1)} → leg naik batal, bukan koreksi lagi.`
      : `Tembus di atas $${invPrice.toFixed(1)} → leg turun batal, bukan koreksi lagi.`,
  }

  // ── RUANG GERAK HARI INI ──
  const dr = dailyRanges(h1)
  let room: Projection['room'] = null
  if (dr.length >= 2 && dayHigh > dayLow) {
    // Hari berjalan dikecualikan dari rata-rata supaya pembandingnya adil
    const past = dr.slice(0, -1)
    const typical = past.reduce((a, b) => a + b, 0) / past.length
    const todayRange = dayHigh - dayLow
    const usedPct = typical > 0 ? (todayRange / typical) * 100 : 0
    room = {
      usedPct, todayRange, typical,
      note: usedPct >= 100
        ? 'Range harian sudah terlampaui — lanjutan cenderung melambat, target jauh jadi kurang realistis.'
        : usedPct >= 70
          ? 'Sebagian besar range harian sudah terpakai — sisa ruang terbatas.'
          : 'Masih ada ruang gerak untuk hari ini.',
    }
  }

  const dirNote = dir === 'naik'
    ? 'Leg impuls terakhir NAIK — target di atas, koreksi diukur turun dari puncak.'
    : dir === 'turun'
      ? 'Leg impuls terakhir TURUN — target di bawah, koreksi diukur naik dari dasar.'
      : 'Leg dan posisi harga terhadap EMA21 bertentangan — arah belum meyakinkan.'

  return {
    dir, dirNote, legLo: lastLow, legHi: lastHigh,
    targets, retracements, invalidation, room,
    note: `Semua level dari leg $${lastLow.toFixed(1)}–$${lastHigh.toFixed(1)} (ATR ${atr.toFixed(1)}). Level = tempat harga cenderung bereaksi, bukan jaminan arah.`,
  }
}
