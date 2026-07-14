// Renderer Markdown ringkas untuk output analisa Claude (heading, bullet, bold/italic/code).
// Dipakai bersama oleh JournalAiAnalysis & panel AI terminal.

function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i} className="italic">{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="bg-muted/80 px-1 rounded text-xs font-mono">{p.slice(1, -1)}</code>
    return <span key={i}>{p}</span>
  })
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const els: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (!list.length) return
    els.push(<ul key={`ul${els.length}`} className="space-y-1 my-1.5">{list.map((it, i) => (
      <li key={i} className="flex gap-2 items-start text-sm leading-relaxed"><span className="text-primary text-xs shrink-0 mt-1">•</span><span className="text-foreground/85">{renderInline(it)}</span></li>
    ))}</ul>)
    list = []
  }
  lines.forEach((line, i) => {
    const t = line.trim()
    if (!t) { flush(); els.push(<div key={`b${i}`} className="h-1.5" />); return }
    if (t.startsWith('### ')) { flush(); els.push(<p key={i} className="text-[10px] font-bold text-foreground/50 uppercase tracking-widest mt-3 mb-1">{t.slice(4)}</p>); return }
    if (t.startsWith('## ')) { flush(); els.push(<p key={i} className="text-sm font-black text-primary mt-4 mb-1">{t.slice(3)}</p>); return }
    if (t.startsWith('# ')) { flush(); els.push(<p key={i} className="text-base font-black text-foreground mt-3 mb-1">{t.slice(2)}</p>); return }
    const b = t.match(/^(?:[-•*]|\d+\.)\s+(.+)/)
    if (b) { list.push(b[1]); return }
    flush()
    els.push(<p key={i} className="text-sm leading-relaxed text-foreground/85">{renderInline(t)}</p>)
  })
  flush()
  return <div>{els}</div>
}
