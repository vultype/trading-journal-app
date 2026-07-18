import React from 'react'

// Renderer Markdown ringan (tanpa dependensi) → elemen React (aman, bukan innerHTML).
// Mendukung: # ## ### heading, **tebal**, *miring*, `code`, [link](url), ![img](url),
// list (- / 1.), > kutipan, ``` code block, --- garis. Cukup untuk blog & outlook.

function inline(text: string, kb: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0, m: RegExpExecArray | null, i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[2] != null) out.push(<strong key={kb + i} className="font-bold text-white/95">{m[2]}</strong>)
    else if (m[4] != null) out.push(<em key={kb + i}>{m[4]}</em>)
    else if (m[6] != null) out.push(<code key={kb + i} className="rounded bg-white/10 px-1.5 py-0.5 text-[0.88em] font-mono">{m[6]}</code>)
    else if (m[8] != null) out.push(<a key={kb + i} href={m[9]} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{m[8]}</a>)
    last = m.index + m[0].length; i++
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n')
  const b: React.ReactNode[] = []
  let i = 0, k = 0
  const special = /^(#{1,3}\s|[-*]\s|\d+\.\s|>|```|!\[)/
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (line.trim().startsWith('```')) {
      const buf: string[] = []; i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++ }
      i++
      b.push(<pre key={k++} className="rounded-xl bg-black/40 border border-white/10 p-4 overflow-x-auto text-sm text-white/80 my-5"><code>{buf.join('\n')}</code></pre>)
      continue
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length, kids = inline(h[2], `h${k}`)
      if (lvl === 1) b.push(<h2 key={k++} className="text-2xl md:text-3xl font-black tracking-tight mt-9 mb-3 text-white text-balance">{kids}</h2>)
      else if (lvl === 2) b.push(<h3 key={k++} className="text-xl md:text-2xl font-black tracking-tight mt-8 mb-3 text-white text-balance">{kids}</h3>)
      else b.push(<h4 key={k++} className="text-lg font-bold mt-6 mb-2 text-white/90">{kids}</h4>)
      i++; continue
    }
    if (/^(---|\*\*\*)\s*$/.test(line)) { b.push(<hr key={k++} className="my-7 border-white/10" />); i++; continue }
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/)
    if (img) {
      // eslint-disable-next-line @next/next/no-img-element
      b.push(<img key={k++} src={img[2]} alt={img[1]} className="rounded-2xl my-6 w-full border border-white/10" />)
      i++; continue
    }
    if (line.startsWith('>')) {
      const buf: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      b.push(<blockquote key={k++} className="border-l-2 border-primary/50 pl-4 my-5 text-white/65 italic">{inline(buf.join(' '), `q${k}`)}</blockquote>)
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s+/, '')); i++ }
      b.push(<ul key={k++} className="list-disc pl-5 my-4 space-y-1.5 text-white/75 marker:text-primary/60">{items.map((it, x) => <li key={x}>{inline(it, `ul${k}${x}`)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s+/, '')); i++ }
      b.push(<ol key={k++} className="list-decimal pl-5 my-4 space-y-1.5 text-white/75 marker:text-primary/60 marker:font-bold">{items.map((it, x) => <li key={x}>{inline(it, `ol${k}${x}`)}</li>)}</ol>)
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !special.test(lines[i]) && !/^(---|\*\*\*)\s*$/.test(lines[i])) { buf.push(lines[i]); i++ }
    b.push(<p key={k++} className="my-4 leading-[1.75] text-white/75">{inline(buf.join(' '), `p${k}`)}</p>)
  }
  return <div className={className}>{b}</div>
}
