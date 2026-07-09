import Script from 'next/script'
import { PixelScripts } from '@/components/PixelScripts'

const PLATFORM_PIXELS = [
  { platform: 'google' as const, pixel_id: 'AW-11452527910' },
]

export function GlobalPixels() {
  return (
    <>
      <PixelScripts pixels={PLATFORM_PIXELS} />
      <Script id="google-ads-pageview" strategy="afterInteractive">
        {`
          gtag('event', 'conversion', {
            'send_to': 'AW-11452527910/0TVKCLaixc0cEKbq_tQq',
            'value': 1.0,
            'currency': 'BRL'
          });
        `}
      </Script>
    </>
  )
}
