import type { MetadataRoute } from 'next'
import { getSiteConfig } from '@/lib/site-config'
import { getPublishedSlugs } from '@/lib/content'

export const revalidate = 3600

// Halaman PUBLIK yang layak diindeks (halaman ber-auth seperti /hub /terminal /account
// /admin /checkout /lot-calculator /daily-outlook sengaja dikecualikan).
const ROUTES: { path: string; priority: number }[] = [
  { path: '/', priority: 1 },
  { path: '/blog', priority: 0.8 },
  { path: '/jurnal-trading-tools', priority: 0.8 },
  { path: '/upgrade', priority: 0.8 },
  { path: '/faq', priority: 0.6 },
  { path: '/kontak', priority: 0.5 },
  { path: '/syarat-ketentuan', priority: 0.3 },
  { path: '/kebijakan-refund', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteUrl } = await getSiteConfig()
  const base = siteUrl.replace(/\/$/, '')
  const slugs = await getPublishedSlugs()
  const staticUrls: MetadataRoute.Sitemap = ROUTES.map(r => ({
    url: base + (r.path === '/' ? '' : r.path),
    changeFrequency: 'weekly',
    priority: r.priority,
  }))
  const blogUrls: MetadataRoute.Sitemap = slugs.map(slug => ({
    url: `${base}/blog/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
  return [...staticUrls, ...blogUrls]
}
