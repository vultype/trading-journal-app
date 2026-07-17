'use client'

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { track } from '@/lib/pixel'

// Base Meta Pixel + PageView otomatis (termasuk saat pindah halaman client-side / SPA).
// Dikontrol dari Admin CMS: layout hanya merender ini kalau `enabled` & `pixelId` terisi.
export function MetaPixel({ pixelId, enabled }: { pixelId: string; enabled: boolean }) {
  const pathname = usePathname()
  const mounted = useRef(false)

  // Init + PageView pertama dilakukan oleh <Script> di bawah. Effect ini hanya menangani
  // PageView untuk navigasi berikutnya (App Router = client-side, tak reload script).
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return } // lewati mount pertama
    track('PageView')
  }, [pathname])

  if (!enabled || !pixelId) return null

  return (
    <Script id="meta-pixel" strategy="afterInteractive">{`
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window,document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      fbq('init', '${pixelId}');
      fbq('track', 'PageView');
    `}</Script>
  )
}
