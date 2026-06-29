import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY belum dikonfigurasi di .env.local' }, { status: 500 })
  }

  const { pair, direction, result, pnl, strategy, market_structure, followed_plan, know_direction } =
    await req.json()

  const structureLabel =
    market_structure === 'bullish' ? 'Bullish (uptrend)'
    : market_structure === 'bearish' ? 'Bearish (downtrend)'
    : market_structure === 'ranging' ? 'Ranging / Sideways'
    : 'Tidak ditentukan'

  const prompt = `Kamu adalah AI coach trading profesional yang berpengalaman. Berikan analisa singkat, jujur, dan konstruktif untuk trade berikut dalam bahasa Indonesia.

Data Trade:
- Instrumen: ${pair}
- Arah Entry: ${direction === 'long' ? 'LONG (Buy)' : 'SHORT (Sell)'}
- Market Structure: ${structureLabel}
- Strategi: ${strategy || 'Tidak disebutkan'}
- Hasil: ${result === 'win' ? '✅ WIN' : result === 'loss' ? '❌ LOSS' : '⚖️ BREAKEVEN'}
- P&L: ${Number(pnl) > 0 ? '+' : ''}${pnl}
- Ikut Trading Plan: ${followed_plan === true ? 'Ya ✓' : followed_plan === false ? 'Tidak ✗' : 'N/A'}
- Tahu Arah Market: ${know_direction === true ? 'Ya ✓' : know_direction === false ? 'Tidak ✗' : 'N/A'}

Tulis analisa dalam 3 poin singkat (masing-masing 1-2 kalimat):
• Evaluasi: apakah entry sesuai market structure dan arah yang benar?
• Pelajaran: apa yang bisa dipetik dari trade ini?
• Saran: rekomendasi konkret untuk trade berikutnya.

Langsung to the point, tanpa basa-basi pembuka.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return NextResponse.json({ analysis: text })
}
