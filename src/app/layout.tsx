import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { ThemeProvider } from "@/components/ThemeProvider"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Datalitiq AI Terminal — Analisa Emas (XAU/USD) Berbasis AI",
  description: "Berhenti trading pakai feeling. Datalitiq AI menggabungkan harga, kondisi ekonomi, dan sentimen pasar jadi satu kesimpulan yang jelas & mudah dipahami — arah pasar, tingkat keyakinan, dan alasannya.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full ${jakarta.variable}`} suppressHydrationWarning>
      <body className="h-full bg-background text-foreground font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
