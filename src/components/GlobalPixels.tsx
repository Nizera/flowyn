import Script from 'next/script'
import { PixelScripts } from '@/components/PixelScripts'

export function GlobalPixels() {
  const pixel_id = process.env.NEXT_PUBLIC_GOOGLE_ADS_PIXEL_ID || ''
  const conversion_label = process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL || ''

  if (!pixel_id) {
    return null
  }

  return (
    <>
      <PixelScripts pixels={[{ platform: 'google' as const, pixel_id }]} />
      <Script id="google-ads-pageview" strategy="afterInteractive">
        {`
          gtag('event', 'conversion', {
            'send_to': '${pixel_id}/${conversion_label}',
            'value': 1.0,
            'currency': 'BRL'
          });
        `}
      </Script>
    </>
  )
}
