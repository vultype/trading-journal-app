// Konfigurasi situs (SEO, analytics, pixel) dibaca SERVER-SIDE dari app_config.
// Dipakai bersama oleh root layout, sitemap, dan robots. Memakai `select=*` supaya
// TAHAN terhadap kolom yang belum dimigrasikan (kolom hilang → undefined, bukan error).
const SB_URL = "https://lmoduthkogsystlnljlb.supabase.co"
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2R1dGhrb2dzeXN0bG5samxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDA1MDEsImV4cCI6MjA5ODExNjUwMX0.bVWD_H9bYzvE4lK6hg-mjw5nA0_qYi1D2vzROzhL-4Q"

export const DEFAULT_SITE_URL = "https://datalitiq.com"
export const DEFAULT_TITLE = "Datalitiq AI Terminal — Analisa Emas (XAU/USD) Berbasis AI"
export const DEFAULT_DESC = "Berhenti trading pakai feeling. Datalitiq AI menggabungkan harga, kondisi ekonomi, dan sentimen pasar jadi satu kesimpulan yang jelas & mudah dipahami — arah pasar, tingkat keyakinan, dan alasannya."

export type SiteConfig = {
  siteUrl: string; seoTitle: string; seoDescription: string
  gaId: string; gaEnabled: boolean; gscVerification: string
  pixelId: string; pixelEnabled: boolean
}

const FALLBACK: SiteConfig = {
  siteUrl: DEFAULT_SITE_URL, seoTitle: DEFAULT_TITLE, seoDescription: DEFAULT_DESC,
  gaId: "", gaEnabled: false, gscVerification: "", pixelId: "", pixelEnabled: false,
}

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/app_config?id=eq.1&select=*`, {
      headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` },
      next: { revalidate: 30 },
    })
    if (!res.ok) return FALLBACK
    const rows = await res.json()
    const r = (Array.isArray(rows) ? rows[0] : null) as Record<string, unknown> | null
    if (!r) return FALLBACK
    const str = (k: string, d = "") => { const v = r[k]; return typeof v === "string" && v.trim() ? v.trim() : d }
    return {
      siteUrl: str("site_url", DEFAULT_SITE_URL).replace(/\/$/, ""),
      seoTitle: str("seo_title", DEFAULT_TITLE),
      seoDescription: str("seo_description", DEFAULT_DESC),
      gaId: str("ga_measurement_id"),
      gaEnabled: !!r["ga_enabled"],
      gscVerification: str("gsc_verification"),
      pixelId: str("meta_pixel_id"),
      pixelEnabled: !!r["meta_pixel_enabled"],
    }
  } catch { return FALLBACK }
}
