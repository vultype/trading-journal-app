import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Analisa jurnal trading dengan Claude. Client mengirim ringkasan data jurnal
// (statistik, breakdown strategi/pair/jam/psikologi, sampel trade) + prompt opsional.
// Mode 'auto' = analisa performa menyeluruh; mode 'custom' = jawab pertanyaan trader.
// Dipakai admin-only (gating di UI). Balas Markdown bebas (bukan JSON).

const SYSTEM = `Kamu adalah trading performance coach sekaligus analis kuantitatif untuk seorang trader ritel (fokus XAUUSD/emas). Kamu diberi RINGKASAN DATA JURNAL TRADING NYATA milik trader tsb. Analisamu harus tajam, jujur, berbasis angka, dan bisa langsung dijalankan — bukan motivasi kosong.

Prinsip:
- Selalu rujuk angka spesifik dari data (win rate, expectancy/P&L per trade, jam, sesi, strategi, pair, kepatuhan plan, overtrade).
- Bedakan sinyal dari noise: kalau sampel sebuah kelompok kecil (mis. <5 trade), sebutkan bahwa belum signifikan.
- Fokus ke: (1) kekuatan yang harus dipertahankan, (2) kebocoran/leak yang menggerus profit, (3) pola disiplin — ikut plan vs tidak, overtrade, tahu arah vs tidak, (4) waktu/sesi/strategi/pair terbaik & terburuk.
- Akhiri dengan rekomendasi konkret & terprioritas yang bisa langsung dijalankan minggu depan.
- Bahasa Indonesia. Format Markdown: pakai '## ' untuk judul bagian, '- ' untuk poin, '**tebal**' untuk penekanan angka/kesimpulan penting. Padat, tidak bertele-tele.
- JANGAN mengarang data yang tidak ada di ringkasan. Ini alat bantu refleksi, bukan nasihat keuangan.`

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'Fitur AI belum aktif — ANTHROPIC_API_KEY belum diset' }, { status: 503 })
  try {
    const { snapshot, prompt, mode } = await req.json()
    if (!snapshot || typeof snapshot !== 'object') return NextResponse.json({ error: 'data jurnal kosong' }, { status: 400 })

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const dataBlock = `RINGKASAN DATA JURNAL (mata uang: ${snapshot.currency ?? '-'}):\n${JSON.stringify(snapshot, null, 1)}`

    const isCustom = mode === 'custom' && typeof prompt === 'string' && prompt.trim().length > 0
    const instruction = isCustom
      ? `PERTANYAAN / PERMINTAAN TRADER:\n"${prompt.trim()}"\n\nJawab spesifik berdasarkan data jurnal di atas. Kalau data tidak cukup untuk menjawab, katakan terus terang dan sarankan data apa yang perlu dicatat.`
      : `Buat ANALISA PERFORMA MENYELURUH dari data jurnal di atas. Susun dengan bagian: ## Ringkasan Kondisi, ## Yang Sudah Bagus, ## Kebocoran / Yang Menggerus Profit, ## Pola Disiplin & Psikologi, ## Waktu / Sesi / Strategi, lalu ## Rekomendasi Prioritas (3-5 aksi konkret).`

    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2600,
      system: SYSTEM,
      messages: [{ role: 'user', content: `${dataBlock}\n\n${instruction}` }],
    })

    const text = msg.content.find(b => b.type === 'text')?.text ?? ''
    if (!text.trim()) throw new Error('AI tidak mengembalikan jawaban')
    return NextResponse.json({ text, mode: isCustom ? 'custom' : 'auto', at: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'gagal menganalisa' }, { status: 502 })
  }
}
