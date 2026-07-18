'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

// Google Analytics 4 (gtag.js). Init + page_view pertama dari script; navigasi SPA
// (App Router) dikirim manual per pergantian pathname. Dikontrol dari Admin CMS (tab SEO).
export function GoogleAnalytics({ gaId, enabled }: { gaId: string; enabled: boolean }) {
  const pathname = usePathname()
  const mounted = useRef(false)

  useEffect(() => {
    if (!enabled || !gaId) return
    if (!mounted.current) { mounted.current = true; return } // mount pertama sudah di-config
    const w = window as unknown as { gtag?: (...a: unknown[]) => void }
    if (typeof w.gtag === 'function') w.gtag('event', 'page_view', { page_path: pathname, page_location: window.location.href })
  }, [pathname, enabled, gaId])

  if (!enabled || !gaId) return null

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
      <Script id="ga4-init" strategy="afterInteractive">{`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gaId}');
      `}</Script>
    </>
  )
}
