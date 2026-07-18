import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/ThemeProvider"
import { MetaPixel } from "@/components/MetaPixel"
import { GoogleAnalytics } from "@/components/GoogleAnalytics"
import { getSiteConfig } from "@/lib/site-config"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
})

// Metadata dinamis dari CMS (title, description, verifikasi Google Search Console, canonical, OG).
export async function generateMetadata(): Promise<Metadata> {
  const c = await getSiteConfig()
  return {
    metadataBase: new URL(c.siteUrl),
    title: c.seoTitle,
    description: c.seoDescription,
    alternates: { canonical: "/" },
    openGraph: { title: c.seoTitle, description: c.seoDescription, url: c.siteUrl, siteName: "Datalitiq", type: "website", locale: "id_ID" },
    twitter: { card: "summary_large_image", title: c.seoTitle, description: c.seoDescription },
    verification: c.gscVerification ? { google: c.gscVerification } : undefined,
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const c = await getSiteConfig()
  return (
    <html lang="id" className={`h-full ${jakarta.variable}`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans antialiased">
        <MetaPixel pixelId={c.pixelId} enabled={c.pixelEnabled} />
        <GoogleAnalytics gaId={c.gaId} enabled={c.gaEnabled} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
