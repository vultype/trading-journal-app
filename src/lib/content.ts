// Fetch konten publik (blog) SERVER-SIDE via REST + anon key. RLS hanya mengizinkan
// baris published untuk anon, jadi aman. Dipakai halaman /blog, /blog/[slug], sitemap.
const SB_URL = "https://lmoduthkogsystlnljlb.supabase.co"
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2R1dGhrb2dzeXN0bG5samxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDA1MDEsImV4cCI6MjA5ODExNjUwMX0.bVWD_H9bYzvE4lK6hg-mjw5nA0_qYi1D2vzROzhL-4Q"

export type BlogPost = {
  id: string; slug: string; title: string; excerpt: string | null; cover_url: string | null
  content: string | null; tag: string | null; published: boolean; published_at: string | null
  created_at: string; updated_at: string | null
}

async function rest<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const j = await res.json()
    return Array.isArray(j) ? j : []
  } catch { return [] }
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  return rest<BlogPost>('blog_posts?published=eq.true&order=published_at.desc.nullslast,created_at.desc&select=id,slug,title,excerpt,cover_url,tag,published_at,created_at')
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const rows = await rest<BlogPost>(`blog_posts?slug=eq.${encodeURIComponent(slug)}&published=eq.true&select=*&limit=1`)
  return rows[0] ?? null
}

export async function getPublishedSlugs(): Promise<string[]> {
  const rows = await rest<{ slug: string }>('blog_posts?published=eq.true&select=slug')
  return rows.map(r => r.slug)
}
