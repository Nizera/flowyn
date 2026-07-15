'use client'

import { useEffect } from 'react'
import Script from 'next/script'

interface PixelConfig {
  platform: 'meta' | 'google' | 'tiktok'
  pixel_id: string
}

interface Props {
  pixels: PixelConfig[]
  amount: number
  orderId: string
}

export function PixelFireBackup({ pixels, amount, orderId }: Props) {
  const metaPixels = pixels.filter(p => p.platform === 'meta')
  const googlePixels = pixels.filter(p => p.platform === 'google')
  const tiktokPixels = pixels.filter(p => p.platform === 'tiktok')

  useEffect(() => {
    const eventId = `order_${orderId}`

    if (window.fbq) {
      metaPixels.forEach(p => {
        window.fbq!('init', p.pixel_id)
        window.fbq!('track', 'Purchase', { value: amount, currency: 'BRL', eventID: eventId })
      })
    }

    if (window.gtag) {
      googlePixels.forEach(p => {
        window.gtag!('event', 'conversion', {
          send_to: p.pixel_id,
          value: amount,
          currency: 'BRL',
          transaction_id: eventId,
        })
      })
    }

    if (window.ttq) {
      tiktokPixels.forEach(p => {
        window.ttq!.load(p.pixel_id)
        window.ttq!.track('CompletePayment', { value: amount, currency: 'BRL' })
      })
    }
  }, [amount, orderId, metaPixels, googlePixels, tiktokPixels])

  return (
    <>
      {metaPixels.length > 0 && (
        <Script id="meta-pixel-backup" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
            document,'script','https://connect.facebook.net/en_US/fbevents.js');
            ${metaPixels.map(p => `fbq('init','${p.pixel_id}');`).join('\n')}
          `}
        </Script>
      )}

      {googlePixels.map(p => (
        <Script
          key={`gtag-backup-${p.pixel_id}`}
          id={`gtag-backup-${p.pixel_id}`}
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${p.pixel_id}`}
        />
      ))}
      {googlePixels.length > 0 && (
        <Script id="google-gtag-backup" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('js', new Date());
            ${googlePixels.map(p => `gtag('config','${p.pixel_id}');`).join('\n')}
          `}
        </Script>
      )}

      {tiktokPixels.length > 0 && (
        <Script id="tiktok-pixel-backup" strategy="afterInteractive">
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
            ${tiktokPixels.map(p => `ttq.load('${p.pixel_id}');`).join('\n')}
            }(window,document,'ttq');
          `}
        </Script>
      )}
    </>
  )
}
