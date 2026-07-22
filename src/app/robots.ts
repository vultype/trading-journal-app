import type { MetadataRoute } from 'next'
import { getSiteConfig } from '@/lib/site-config'

export const revalidate = 3600

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { siteUrl } = await getSiteConfig()
  const base = siteUrl.replace(/\/$/, '')
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /s/ = tautan berbagi ringkasan keuangan. Pribadi, tidak boleh terindeks
      // (halamannya juga sudah memasang meta robots noindex).
      disallow: ['/admin', '/hub', '/account', '/checkout', '/terminal', '/lot-calculator', '/keuangan', '/s/', '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
