import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar } from 'lucide-react'
import { getPostBySlug, getPublishedSlugs } from '@/lib/content'
import { Markdown } from '@/lib/markdown'

export const revalidate = 60

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs()
  return slugs.map(slug => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'Artikel tidak ditemukan — Datalitiq' }
  const desc = post.excerpt || post.title
  return {
    title: `${post.title} — Datalitiq`,
    description: desc,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { title: post.title, description: desc, type: 'article', images: post.cover_url ? [post.cover_url] : undefined, publishedTime: post.published_at || undefined },
    twitter: { card: 'summary_large_image', title: post.title, description: desc, images: post.cover_url ? [post.cover_url] : undefined },
  }
}

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  return (
    <div className="min-h-screen bg-[#060a09] text-white overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
      <header className="relative max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/blog" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors"><ArrowLeft size={16} /> Semua artikel</Link>
        <Link href="/" className="text-lg font-black tracking-tight">Datalitiq</Link>
      </header>

      <article className="relative max-w-3xl mx-auto px-5 pt-6 pb-20">
        <div className="mb-6">
          {post.tag && <span className="inline-flex items-center rounded-full bg-primary/12 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mb-4">{post.tag}</span>}
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-balance leading-tight">{post.title}</h1>
          <div className="flex items-center gap-2 mt-4 text-[13px] text-white/45">
            <Calendar size={13} /> {fmtDate(post.published_at || post.created_at)}
          </div>
        </div>

        {post.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.cover_url} alt={post.title} className="w-full rounded-2xl border border-white/10 mb-8 object-cover max-h-[420px]" />
        )}

        {post.excerpt && <p className="text-lg text-white/70 leading-relaxed mb-6 pb-6 border-b border-white/[0.08]">{post.excerpt}</p>}

        <Markdown text={post.content || ''} className="text-[15px]" />

        <div className="mt-12 pt-6 border-t border-white/[0.08] flex items-center justify-between gap-4 flex-wrap">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors"><ArrowLeft size={15} /> Kembali ke blog</Link>
          <Link href="/upgrade" className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25">Coba Terminal AI Datalitiq</Link>
        </div>
      </article>
    </div>
  )
}
