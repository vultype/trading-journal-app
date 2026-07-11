'use client'

export function BrandLogo({ url, size = 'sm' }: { url?: string | null; size?: 'sm' | 'lg' }) {
  if (url) {
    return (
      <img
        src={url}
        alt="Logo"
        className={size === 'lg' ? 'h-11 w-auto max-w-[220px] object-contain' : 'h-7 w-auto max-w-[150px] object-contain'}
      />
    )
  }
  // Fallback teks bila belum ada logo
  return (
    <span className={size === 'lg' ? 'text-3xl font-black tracking-tight' : 'text-base font-black tracking-tight'}>
      Datalitiq
    </span>
  )
}
