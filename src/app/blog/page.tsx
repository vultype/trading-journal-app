import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Newspaper } from 'lucide-react'
import { getPublishedPosts, type BlogPost } from '@/lib/content'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Blog & Wawasan — Datalitiq',
  description: 'Analisa, edukasi & wawasan trading emas XAU/USD dari tim Datalitiq. Makro, teknikal, manajemen risiko & psikologi trading.',
  alternates: { canonical: '/blog' },
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

function Cover({ post, className }: { post: BlogPost; className: string }) {
  if (post.cover_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.cover_url} alt={post.title} className={`object-cover ${className}`} />
  }
  return <div className={`flex items-center justify-center bg-gradient-to-br from-primary/15 to-white/[0.02] ${className}`}><Newspaper className="text-primary/30" size={40} /></div>
}

export default async function BlogPage() {
  const posts = await getPublishedPosts()
  const [featured, ...rest] = posts

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
      <header className="relative max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Beranda</Link>
        <Link href="/" className="text-lg font-black tracking-tight">Datalitiq</Link>
      </header>

      <main className="relative max-w-5xl mx-auto px-5 pt-8 pb-20">
        <div className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-1.5">Blog & Wawasan</p>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">Belajar & baca analisa emas</h1>
          <p className="text-sm text-white/50 mt-2 max-w-xl leading-relaxed">Makro, teknikal, manajemen risiko & psikologi trading XAU/USD — dirangkum agar mudah dipahami.</p>
        </div>

        {!posts.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <Newspaper className="mx-auto text-white/25 mb-3" size={32} />
            <p className="text-white/50">Belum ada artikel. Nantikan tulisan pertama kami.</p>
          </div>
        ) : (
          <>
            {/* Featured */}
            <Link href={`/blog/${featured.slug}`} className="group block rounded-3xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-primary/25 transition-colors mb-8">
              <div className="grid md:grid-cols-2">
                <Cover post={featured} className="w-full h-56 md:h-full min-h-[220px]" />
                <div className="p-6 md:p-8 flex flex-col justify-center">
                  {featured.tag && <span className="inline-flex w-fit items-center rounded-full bg-primary/12 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mb-3">{featured.tag}</span>}
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight text-balance group-hover:text-primary transition-colors">{featured.title}</h2>
                  {featured.excerpt && <p className="text-sm text-white/55 mt-3 leading-relaxed line-clamp-3">{featured.excerpt}</p>}
                  <div className="flex items-center gap-2 mt-5 text-[12px] text-white/40">
                    <span>{fmtDate(featured.published_at || featured.created_at)}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-primary font-semibold">Baca <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" /></span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Grid */}
            {rest.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {rest.map(p => (
                  <Link key={p.id} href={`/blog/${p.slug}`} className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden hover:border-primary/25 transition-colors">
                    <Cover post={p} className="w-full h-40" />
                    <div className="p-5 flex flex-col flex-1">
                      {p.tag && <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 mb-1.5">{p.tag}</span>}
                      <h3 className="text-base font-black tracking-tight leading-snug text-balance group-hover:text-primary transition-colors">{p.title}</h3>
                      {p.excerpt && <p className="text-[13px] text-white/50 mt-2 leading-relaxed line-clamp-2 flex-1">{p.excerpt}</p>}
                      <p className="text-[11px] text-white/35 mt-4">{fmtDate(p.published_at || p.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
