// Konfigurasi UI utk halaman detail /terminal/data/macro/[key] — 1 entry per
// FRED_SERIES (lib/fred.ts). Dipisah dari fred.ts karena butuh komponen Icon
// (lucide-react), sedangkan fred.ts murni server-safe (dipakai route API).
import type { ElementType } from 'react'
import { Landmark, GitBranch, TrendingDown, Flame, Percent, Briefcase, Wallet } from 'lucide-react'

export type MacroDetailMeta = {
  icon: ElementType
  title: string
  explain: string[]       // paragraf penjelasan (urut)
  related: string[]       // key FRED lain yang ditampilkan sbg "indikator berkorelasi"
}

export const MACRO_DETAIL: Record<string, MacroDetailMeta> = {
  dollar: {
    icon: Landmark, title: 'Indeks Dolar (DXY)',
    explain: [
      'Emas (XAU/USD) dihargakan dalam dolar AS. Saat dolar menguat, emas jadi relatif lebih mahal bagi pemegang mata uang lain — permintaan cenderung turun, harga tertekan. Sebaliknya, dolar melemah biasanya mengangkat harga emas.',
      'Dolar sendiri sangat dipengaruhi yield & suku bunga: yield AS naik → dolar cenderung menguat (investor asing memburu imbal hasil) → tekanan ke emas.',
      'Korelasi ini bukan mutlak — di masa risk-off ekstrem, dolar & emas bisa naik bersamaan (sama-sama aset aman). Tapi mayoritas waktu keduanya berlawanan arah.',
    ],
    related: ['us10y', 'realyield', 'fedfunds'],
  },
  us10y: {
    icon: GitBranch, title: 'Yield Treasury 10 Tahun',
    explain: [
      'Yield 10Y adalah imbal hasil obligasi pemerintah AS jangka 10 tahun — patokan "biaya peluang" memegang emas (yang tidak memberi bunga).',
      'Yield naik = investor dapat imbal hasil lebih tinggi dari aset "bebas risiko" → emas jadi kurang menarik dibanding obligasi → tekanan turun. Yield turun = sebaliknya, bullish emas.',
      'Kurva yield (selisih 10Y vs 2Y) juga dipantau: kurva negatif (invert) sering jadi sinyal pasar memperkirakan resesi atau pemangkasan bunga ke depan.',
    ],
    related: ['us02y', 'realyield', 'dollar'],
  },
  us02y: {
    icon: GitBranch, title: 'Yield Treasury 2 Tahun',
    explain: [
      'Yield 2Y lebih sensitif terhadap ekspektasi kebijakan Fed jangka pendek dibanding yield 10Y (yang lebih mencerminkan ekspektasi jangka panjang/inflasi).',
      'Naik tajam biasanya berarti pasar memperkirakan Fed akan menahan atau menaikkan suku bunga lebih lama — bearish untuk emas dalam jangka pendek.',
      'Selisih 10Y−2Y (kurva yield) adalah salah satu indikator resesi paling dipantau di pasar obligasi.',
    ],
    related: ['us10y', 'fedfunds'],
  },
  realyield: {
    icon: TrendingDown, title: 'Real Yield 10Y (TIPS)',
    explain: [
      'Real yield = yield nominal dikurangi ekspektasi inflasi (breakeven). Ini ukuran imbal hasil "riil" setelah inflasi — korelasi paling kuat & konsisten dengan harga emas dari semua indikator makro.',
      'Real yield turun (bahkan negatif) = memegang obligasi rugi setelah inflasi → emas jadi pilihan lindung nilai yang lebih menarik → bullish kuat.',
      'Real yield naik = obligasi kembali menarik secara riil → tekanan ke emas.',
    ],
    related: ['us10y', 'breakeven', 'dollar'],
  },
  breakeven: {
    icon: Flame, title: 'Ekspektasi Inflasi 10Y (Breakeven)',
    explain: [
      'Breakeven inflation = selisih yield obligasi biasa vs TIPS (obligasi terproteksi inflasi) — mencerminkan ekspektasi pasar terhadap inflasi 10 tahun ke depan.',
      'Naik = pasar memperkirakan inflasi lebih tinggi → biasanya bullish emas (lindung nilai inflasi), TAPI efeknya bisa terimbangi kalau Fed merespons dengan menaikkan suku bunga (yield nominal ikut naik).',
      'Paling bermakna kalau dibaca bersama real yield — breakeven naik + real yield turun = kombinasi paling bullish untuk emas.',
    ],
    related: ['realyield', 'cpi'],
  },
  cpi: {
    icon: Flame, title: 'CPI (Inflasi Headline)',
    explain: [
      'Consumer Price Index — ukuran inflasi paling banyak diliput media, meliputi SEMUA kategori termasuk makanan & energi yang volatil.',
      'Inflasi tinggi & mereda → membuka ruang Fed memangkas suku bunga → bullish emas jangka menengah. Inflasi naik & masih panas → Fed cenderung menahan bunga tinggi → bearish emas.',
      'The Fed sebenarnya lebih memantau Core PCE (bukan CPI) untuk keputusan kebijakan — CPI lebih berpengaruh ke sentimen pasar jangka pendek saat rilis.',
    ],
    related: ['corecpi', 'corepce', 'fedfunds'],
  },
  corecpi: {
    icon: Flame, title: 'Core CPI (ex Food & Energy)',
    explain: [
      'Core CPI mengeluarkan komponen makanan & energi yang volatil — dianggap gambaran inflasi "mendasar" yang lebih stabil dibanding CPI headline.',
      'Trader lebih percaya Core CPI untuk menilai tren inflasi jangka menengah dibanding angka headline yang bisa terdistorsi harga minyak/pangan sesaat.',
      'Sama seperti CPI: mereda = dovish/bullish emas, panas & persisten = hawkish/bearish emas.',
    ],
    related: ['cpi', 'corepce', 'wagegrowth'],
  },
  corepce: {
    icon: Flame, title: 'Core PCE (Gauge Favorit The Fed)',
    explain: [
      'Personal Consumption Expenditures (inti) adalah ukuran inflasi RESMI yang jadi acuan utama The Federal Reserve dalam menentukan kebijakan suku bunga — lebih penting dari CPI di mata Fed.',
      'Rilis Core PCE sering memicu reaksi pasar emas lebih besar dari CPI meski jarang diliput media umum, karena dampaknya langsung ke ekspektasi kebijakan.',
      'Target resmi Fed adalah 2% YoY — jauh di atas itu = hawkish, mendekati/di bawah = ruang buat dovish.',
    ],
    related: ['cpi', 'fedfunds', 'unrate'],
  },
  fedfunds: {
    icon: Percent, title: 'Fed Funds Rate (Suku Bunga Acuan)',
    explain: [
      'Suku bunga acuan yang ditetapkan The Federal Reserve — dasar dari hampir semua suku bunga lain di ekonomi AS (KPR, kartu kredit, obligasi, dst).',
      'Ekspektasi PEMANGKASAN suku bunga = bullish emas (biaya peluang memegang emas turun). Suku bunga ditahan tinggi lebih lama ("higher for longer") = bearish emas.',
      'Pasar bereaksi lebih ke EKSPEKTASI arah kebijakan ke depan (lewat dot plot & pernyataan Fed) ketimbang angka rate saat ini saja.',
    ],
    related: ['us02y', 'unrate', 'corepce'],
  },
  unrate: {
    icon: Briefcase, title: 'Tingkat Pengangguran',
    explain: [
      'Unemployment rate adalah bagian dari mandat ganda The Fed (bersama stabilitas harga/inflasi) — pasar tenaga kerja lemah mendorong Fed lebih dovish.',
      'Pengangguran naik = sinyal ekonomi melambat → ruang pemangkasan bunga lebih besar → bullish emas. Pengangguran rendah/turun = ekonomi kuat → Fed lebih leluasa menahan bunga tinggi.',
      'Sering dibaca bersama NFP & data upah dalam satu rilis "jobs report" bulanan (Jumat pertama tiap bulan).',
    ],
    related: ['nfp', 'wagegrowth', 'fedfunds'],
  },
  nfp: {
    icon: Briefcase, title: 'Nonfarm Payrolls (NFP)',
    explain: [
      'Perubahan jumlah lapangan kerja non-pertanian bulanan — salah satu rilis data ekonomi AS paling dipantau & paling menggerakkan pasar dalam semalam.',
      'Angka NFP jauh di bawah ekspektasi = pasar tenaga kerja melemah = dovish = bullish emas. Angka jauh di atas ekspektasi = ekonomi kuat = hawkish = bearish emas (biasanya reaksi awal cepat & tajam).',
      'Volatilitas ekstrem umum terjadi dalam menit-menit pertama rilis — masuk sebelum rilis berisiko tinggi (whipsaw).',
    ],
    related: ['unrate', 'wagegrowth'],
  },
  wagegrowth: {
    icon: Wallet, title: 'Pertumbuhan Upah (Average Hourly Earnings)',
    explain: [
      'Kenaikan upah tahunan — komponen kunci "wage-price spiral" yang jadi perhatian Fed karena bisa membuat inflasi bertahan lebih lama.',
      'Upah naik cepat = tekanan inflasi dari sisi biaya tenaga kerja = hawkish = bearish emas jangka pendek. Upah mereda = tanda tekanan inflasi struktural melunak = mendukung skenario dovish.',
      'Biasanya dirilis bersamaan dengan NFP — kombinasi jobs lemah + upah mereda adalah sinyal dovish paling kuat.',
    ],
    related: ['nfp', 'corepce'],
  },
}

export const ALL_MACRO_KEYS = Object.keys(MACRO_DETAIL)

// Icon kecil dipakai di panel "Indikator Berkorelasi" (label saja, tanpa perlu icon per baris).
export const MACRO_LABEL: Record<string, string> = {
  dollar: 'Indeks Dolar', us10y: 'Yield 10Y', us02y: 'Yield 2Y', realyield: 'Real Yield 10Y',
  breakeven: 'Ekspektasi Inflasi', cpi: 'CPI', corecpi: 'Core CPI', corepce: 'Core PCE',
  fedfunds: 'Fed Funds', unrate: 'Pengangguran', nfp: 'NFP', wagegrowth: 'Pertumbuhan Upah',
}
