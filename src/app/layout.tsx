import type { Metadata } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "Trading Jurnal",
  description: "Pisahkan keuangan trading dan personal. Ukur performa nyata.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full dark ${jakarta.variable}`}>
      <body className="h-full bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
