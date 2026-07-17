// Konfigurasi UI utk halaman detail /terminal/data/market/[slug] — data LIVE
// (Twelve Data candle, sama infra dgn chart XAU/USD utama), beda dari FRED
// (harian/lambat). slug = bagian URL (aman, tanpa "/"); apiSymbol = simbol asli
// yang dikirim ke /api/terminal/candles & /api/terminal/crossasset.
import type { ElementType } from 'react'
import { Activity, TrendingUp, Bitcoin, Coins } from 'lucide-react'

export type MarketDetailMeta = {
  slug: string
  apiSymbol: string        // simbol utk /api/terminal/candles?symbol= DAN kunci di respons /api/terminal/crossasset (sama persis)
  icon: ElementType
  title: string
  sub: string
  dec: number
  explain: string[]
}

export const MARKET_DETAIL: Record<string, MarketDetailMeta> = {
  vix: {
    slug: 'vix', apiSymbol: 'VIXY', icon: Activity,
    title: 'VIX (Indeks Ketakutan)', sub: 'Proxy VIXY — volatilitas S&P 500', dec: 2,
    explain: [
      'VIX ("indeks ketakutan") mengukur ekspektasi volatilitas pasar saham AS 30 hari ke depan. Naik tajam = investor memperkirakan pergerakan liar/ketidakpastian tinggi.',
      'VIX melonjak biasanya bersamaan risk-off — investor menjual aset berisiko (saham) dan mencari aset aman, termasuk emas. Korelasi: VIX naik cenderung bullish emas.',
      'VIX rendah & stabil = pasar tenang/percaya diri (risk-on) — uang cenderung mengalir ke aset berisiko, bukan emas.',
    ],
  },
  spx: {
    slug: 'spx', apiSymbol: 'SPY', icon: TrendingUp,
    title: 'S&P 500', sub: 'Proxy SPY — 500 saham besar AS', dec: 2,
    explain: [
      'S&P 500 mewakili kesehatan pasar saham AS secara luas — barometer utama sentimen risk-on/risk-off global.',
      'Saham turun tajam (risk-off) sering bersamaan aliran dana ke aset aman termasuk emas — korelasi negatif jangka pendek saat ada guncangan (crash, krisis).',
      'Dalam kondisi normal, saham & emas bisa naik bersamaan (likuiditas melimpah) — korelasinya tidak selalu berlawanan, tergantung rezim pasar.',
    ],
  },
  ndx: {
    slug: 'ndx', apiSymbol: 'QQQ', icon: TrendingUp,
    title: 'Nasdaq 100', sub: 'Proxy QQQ — saham teknologi besar AS', dec: 2,
    explain: [
      'Nasdaq 100 didominasi saham teknologi — lebih sensitif terhadap ekspektasi suku bunga dibanding S&P 500 (saham growth lebih terpukul saat yield naik).',
      'Sering bergerak lebih volatil dari S&P 500. Penurunan tajam Nasdaq kadang jadi sinyal dini pergeseran sentimen risk-off yang lebih luas.',
      'Dipantau bersama S&P 500 untuk melihat apakah risk-off terbatas ke sektor teknologi atau menyeluruh.',
    ],
  },
  btc: {
    slug: 'btc', apiSymbol: 'BTC/USD', icon: Bitcoin,
    title: 'Bitcoin', sub: 'BTC/USD — aset digital, trading 24/7', dec: 0,
    explain: [
      'Bitcoin kadang disebut "emas digital" — beberapa trader menganggapnya lindung nilai alternatif, tapi korelasinya dengan emas TIDAK konsisten.',
      'Dalam rezim risk-on, BTC lebih sering berperilaku seperti aset berisiko (mengikuti saham teknologi) ketimbang aset aman seperti emas.',
      'Berguna sebagai indikator sentimen risiko 24/7 (termasuk saat pasar AS tutup) — pergerakan tajam BTC bisa jadi sinyal dini pergeseran risk appetite global.',
    ],
  },
  xag: {
    slug: 'xag', apiSymbol: 'XAG/USD', icon: Coins,
    title: 'Perak (Silver)', sub: 'XAG/USD — logam mulia, korelasi tinggi ke emas', dec: 3,
    explain: [
      'Perak bergerak searah dengan emas mayoritas waktu (sama-sama logam mulia/lindung nilai), tapi dengan volatilitas lebih tinggi — dijuluki "emas dengan leverage".',
      'Rasio Emas/Perak (harga emas ÷ harga perak) dipantau trader: rasio tinggi = perak murah relatif ke emas (potensi perak "mengejar"); rasio rendah = sebaliknya.',
      'Perak juga punya permintaan industri (elektronik, panel surya) — sehingga sedikit lebih terpengaruh sentimen ekonomi/manufaktur dibanding emas yang murni aset moneter.',
    ],
  },
}

export const ALL_MARKET_SLUGS = Object.keys(MARKET_DETAIL)
