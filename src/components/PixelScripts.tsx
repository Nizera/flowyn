'use client'

import Script from 'next/script'
import { useEffect } from 'react'

interface PixelConfig {
  platform: 'meta' | 'google' | 'tiktok'
  pixel_id: string
}

interface Props {
  pixels: PixelConfig[]
}

// Expose global purchase fire function for checkout-form to call
declare global {
  interface Window {
    firePixelPurchase?: (amount: number) => void
    fbq?: (...args: any[]) => void
    gtag?: (...args: any[]) => void
    ttq?: { track: (...args: any[]) => void; load: (id: string) => void; page: () => void }
    dataLayer?: any[]
  }
}

export function PixelScripts({ pixels }: Props) {
  const metaPixels   = pixels.filter(p => p.platform === 'meta')
  const googlePixels = pixels.filter(p => p.platform === 'google')
  const tiktokPixels = pixels.filter(p => p.platform === 'tiktok')

  // Fire PageView on mount and register global purchase handler
  useEffect(() => {
    // Meta PageView
    if (window.fbq) {
      metaPixels.forEach(p => {
        window.fbq!('init', p.pixel_id)
        window.fbq!('track', 'PageView')
      })
    }

    // Google page_view fires automatically via gtag config

    // TikTok ViewContent
    if (window.ttq) {
      tiktokPixels.forEach(p => {
        window.ttq!.load(p.pixel_id)
        window.ttq!.page()
      })
    }

    // Register global purchase handler
    window.firePixelPurchase = (amount: number) => {
      // Meta Purchase
      if (window.fbq) {
        window.fbq('track', 'Purchase', { value: amount, currency: 'BRL' })
      }

      // Google conversion
      if (window.gtag) {
        googlePixels.forEach(p => {
          window.gtag!('event', 'conversion', {
            send_to: p.pixel_id,
            value: amount,
            currency: 'BRL',
          })
        })
      }

      // TikTok CompletePayment
      if (window.ttq) {
        window.ttq.track('CompletePayment', { value: amount, currency: 'BRL' })
      }
    }

    return () => { delete window.firePixelPurchase }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* ── META PIXEL ── */}
      {metaPixels.length > 0 && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            ${metaPixels.map(p => `fbq('init','${p.pixel_id}');`).join('\n')}
            fbq('track','PageView');
          `}
        </Script>
      )}

      {/* ── GOOGLE ADS ── */}
      {googlePixels.map(p => (
        <Script
          key={`gtag-${p.pixel_id}`}
          id={`gtag-${p.pixel_id}`}
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${p.pixel_id}`}
        />
      ))}
      {googlePixels.length > 0 && (
        <Script id="google-gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            ${googlePixels.map(p => `gtag('config','${p.pixel_id}');`).join('\n')}
          `}
        </Script>
      )}

      {/* ── TIKTOK PIXEL ── */}
      {tiktokPixels.length > 0 && (
        <Script id="tiktok-pixel" strategy="afterInteractive">
          {`
            !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
            ttq.methods=["page","track","identify","instances","debug","on","off","once",
            "ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){
            t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
            for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
            ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)
            ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
            ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
            ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");
            o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
            var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
            ${tiktokPixels.map(p => `ttq.load('${p.pixel_id}'); ttq.page();`).join('\n')}
            }(window,document,'ttq');
          `}
        </Script>
      )}
    </>
  )
}
