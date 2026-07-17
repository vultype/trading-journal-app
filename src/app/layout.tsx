import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/ThemeProvider"
import { MetaPixel } from "@/components/MetaPixel"
import "./globals.css"

// Kredensial publik Supabase (anon) — sama dengan client, dipakai untuk baca app_config
// dari server (RLS mengizinkan anon SELECT). Aman diekspos: anon key memang publik.
const SB_URL = "https://lmoduthkogsystlnljlb.supabase.co"
const SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxtb2R1dGhrb2dzeXN0bG5samxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NDA1MDEsImV4cCI6MjA5ODExNjUwMX0.bVWD_H9bYzvE4lK6hg-mjw5nA0_qYi1D2vzROzhL-4Q"

// Baca Pixel ID + status dari app_config (di-cache 30s). Kalau kolom belum ada / gagal → pixel off.
async function getPixelConfig(): Promise<{ id: string; enabled: boolean }> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/app_config?id=eq.1&select=meta_pixel_id,meta_pixel_enabled`,
      { headers: { apikey: SB_ANON, Authorization: `Bearer ${SB_ANON}` }, next: { revalidate: 30 } },
    )
    if (!res.ok) return { id: "", enabled: false }
    const rows = await res.json()
    const row = Array.isArray(rows) ? rows[0] : null
    return { id: (row?.meta_pixel_id as string | null) ?? "", enabled: !!row?.meta_pixel_enabled }
  } catch { return { id: "", enabled: false } }
}

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Datalitiq AI Terminal — Analisa Emas (XAU/USD) Berbasis AI",
  description: "Berhenti trading pakai feeling. Datalitiq AI menggabungkan harga, kondisi ekonomi, dan sentimen pasar jadi satu kesimpulan yang jelas & mudah dipahami — arah pasar, tingkat keyakinan, dan alasannya.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pixel = await getPixelConfig()
  return (
    <html lang="id" className={`h-full ${jakarta.variable}`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans antialiased">
        <MetaPixel pixelId={pixel.id} enabled={pixel.enabled} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
