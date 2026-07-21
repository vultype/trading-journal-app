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
  room: {
    usedPct: number        // range hari ini vs median harian
    todayRange: number
    typical: number
    sample: number         // berapa hari dipakai sebagai pembanding (transparansi)
    posInDay: number       // 0..100 — posisi harga dalam range hari ini (0=low, 100=high)
    posLabel: string       // "dekat puncak" / "tengah" / "dekat dasar"
    level: 'sepi' | 'normal' | 'ramai' | 'ekstrem'
    note: string
  } | null
  // Posisi harga terhadap leg impuls — menjawab "sekarang harga ada di mana?"
  legPos: {
    retracePct: number     // 0 = di ujung impuls, 100 = balik penuh ke awal leg
    posPct: number         // 0..100 posisi visual dari legLo ke legHi
    zone: string           // zona di antara level Fib mana
    note: string
  } | null
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

// Range harian dari candle D1 penyedia data — BUKAN dari H1 yang dikelompokkan
// per tanggal kalender.
//
// Kenapa penting: hari perdagangan emas berjalan ~22:00–22:00 UTC, jadi
// mengelompokkan H1 per tanggal kalender MEMOTONG setiap hari jadi dua bagian.
// Tiap potongan punya range lebih kecil → "range normal" jadi terlalu rendah →
// persentase pemakaian menggelembung. Candle D1 sudah memakai batas sesi yang
// benar dari penyedia data, jadi masalah itu hilang.
function dailyRanges(d1: Candle[]): number[] {
  const r = d1.map(k => k.h - k.l).filter(v => v > 0)
  if (r.length < 4) return r
  // Buang sesi tak lengkap (libur/setengah hari) yang range-nya jauh di bawah
  // wajar — kalau ikut dihitung, pembanding jadi terlalu rendah.
  const sorted = [...r].sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  return r.filter(v => v >= med * 0.15)
}

// Median lebih tahan outlier daripada rata-rata. Satu hari rilis NFP/FOMC bisa
// bergerak 5x normal dan menarik rata-rata naik, membuat hari biasa terlihat
// "sepi" padahal tidak.
function median(arr: number[]): number {
  if (!arr.length) return 0
  const s = [...arr].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export type ProjInput = {
  m15: Candle[]
  d1: Candle[]           // candle harian — batas sesi yang benar dari penyedia data
  price: number
  ema21: number
  atr: number
  dayHigh: number
  dayLow: number
}

export function buildProjection(inp: ProjInput): Projection {
  const { m15, d1, price, ema21, atr, dayHigh, dayLow } = inp
  const empty: Projection = {
    dir: 'netral', dirNote: 'Struktur belum jelas — proyeksi belum bisa dihitung.',
    legLo: 0, legHi: 0, targets: [], retracements: [], invalidation: null, room: null, legPos: null,
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

  // ── POSISI HARGA DALAM LEG ──
  // Menjawab "sekarang harga ada di mana" — di ujung impuls, di golden zone,
  // atau sudah balik hampir penuh.
  const posPct = Math.max(0, Math.min(100, ((price - lastLow) / range) * 100))
  const retracePct = Math.max(0, Math.min(100, retNow * 100))
  const zoneOf = (r: number) =>
    r < 23.6 ? 'belum koreksi — masih di ujung impuls'
      : r < 38.2 ? 'koreksi tipis (0–38.2%)'
        : r < 50 ? 'antara 38.2% dan 50%'
          : r < 61.8 ? 'GOLDEN ZONE (50–61.8%)'
            : r < 78.6 ? 'antara 61.8% dan 78.6%'
              : r < 100 ? 'koreksi dalam (>78.6%) — tren diragukan'
                : 'sudah balik penuh — leg batal'
  const zone = zoneOf(retracePct)
  const legPos = {
    retracePct, posPct, zone,
    note: retracePct < 23.6
      ? `Harga masih menempel ${legUp ? 'puncak' : 'dasar'} leg — belum ada pullback berarti. Entry di sini = mengejar.`
      : retracePct >= 50 && retracePct < 61.8
        ? 'Harga di golden zone — area pullback yang paling sering dipakai untuk entry searah leg.'
        : retracePct >= 78.6
          ? 'Koreksi sudah sangat dalam. Kalau leg valid, di sini titik terakhir bertahan; kalau tertembus, arah berbalik.'
          : `Harga di tengah jalur koreksi (${zone}).`,
  }

  // ── RUANG GERAK HARI INI ──
  const dr = dailyRanges(d1)
  let room: Projection['room'] = null
  if (dr.length >= 5 && dayHigh > dayLow) {
    // Hari berjalan (candle D1 terakhir) dikecualikan — masih berjalan, belum
    // adil dibandingkan dengan hari-hari yang sudah selesai.
    const past = dr.slice(0, -1).slice(-30)   // maksimal 30 hari terakhir
    const typical = median(past)
    const todayRange = dayHigh - dayLow
    const usedPct = typical > 0 ? (todayRange / typical) * 100 : 0
    // Posisi harga DALAM range hari ini — ini yang memberi tahu arah kelelahan:
    // dekat puncak = sudah lari ke atas, dekat dasar = sudah lari ke bawah.
    const posInDay = Math.max(0, Math.min(100, ((price - dayLow) / (dayHigh - dayLow)) * 100))
    const posLabel = posInDay >= 75 ? 'dekat puncak hari ini'
      : posInDay <= 25 ? 'dekat dasar hari ini'
        : 'di tengah range hari ini'
    const level: NonNullable<Projection['room']>['level'] =
      usedPct >= 150 ? 'ekstrem' : usedPct >= 100 ? 'ramai' : usedPct >= 60 ? 'normal' : 'sepi'
    const note = level === 'ekstrem'
      ? `Hari ini bergerak jauh di atas normal. Harga ${posLabel} — mengejar arah yang sudah berjalan berisiko tinggi; tunggu pullback atau lewati.`
      : level === 'ramai'
        ? `Range normal sudah terlampaui. Harga ${posLabel} — target jauh kurang realistis, kelanjutan cenderung melambat.`
        : level === 'normal'
          ? `Pergerakan wajar. Harga ${posLabel}, masih ada ruang tersisa.`
          : `Hari sepi — range masih jauh di bawah normal. Cocok menunggu breakout dari kompresi, target besar sulit tercapai.`
    room = { usedPct, todayRange, typical, sample: past.length, posInDay, posLabel, level, note }
  }

  const dirNote = dir === 'naik'
    ? 'Leg impuls terakhir NAIK — target di atas, koreksi diukur turun dari puncak.'
    : dir === 'turun'
      ? 'Leg impuls terakhir TURUN — target di bawah, koreksi diukur naik dari dasar.'
      : 'Leg dan posisi harga terhadap EMA21 bertentangan — arah belum meyakinkan.'

  return {
    dir, dirNote, legLo: lastLow, legHi: lastHigh,
    targets, retracements, invalidation, room, legPos,
    note: `Semua level dari leg $${lastLow.toFixed(1)}–$${lastHigh.toFixed(1)} (ATR ${atr.toFixed(1)}). Level = tempat harga cenderung bereaksi, bukan jaminan arah.`,
  }
}
