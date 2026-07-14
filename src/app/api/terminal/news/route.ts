import { NextResponse } from 'next/server'
import { fetchNews } from '@/lib/news'

// Headline berita multi-sumber (Google News, Fed, Investing, Forexlive) — tampilan mentah.
export async function GET() {
  try {
    const data = await fetchNews()
    if (!data.length) throw new Error('kosong')
    return NextResponse.json(data.slice(0, 18))
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'fetch failed' }, { status: 502 })
  }
}
