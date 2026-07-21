'use client'

import { useEffect, useMemo } from 'react'
import Script from 'next/script'
import { isValidPixelId } from '@/lib/pixel-id-validation'

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
  // CORREÇÃO W1 (auditoria tracking): valida pixel IDs antes de injetar em JS.
  // CORREÇÃO W2 (auditoria tracking): useMemo + signature para evitar re-runs do useEffect.
  const metaPixels = useMemo(
    () => pixels.filter(p => p.platform === 'meta' && isValidPixelId('meta', p.pixel_id)),
    [pixels]
  )
  const googlePixels = useMemo(
    () => pixels.filter(p => p.platform === 'google' && isValidPixelId('google', p.pixel_id)),
    [pixels]
  )
  const tiktokPixels = useMemo(
    () => pixels.filter(p => p.platform === 'tiktok' && isValidPixelId('tiktok', p.pixel_id)),
    [pixels]
  )
  const metaSig = useMemo(() => metaPixels.map(p => p.pixel_id).join(','), [metaPixels])
  const googleSig = useMemo(() => googlePixels.map(p => p.pixel_id).join(','), [googlePixels])
  const tiktokSig = useMemo(() => tiktokPixels.map(p => p.pixel_id).join(','), [tiktokPixels])

  useEffect(() => {
    const eventId = `order_${orderId}`

    // CORREÇÃO C4 (auditoria tracking): o backup de pixel disparava Purchase novamente
    // na success page mesmo quando o checkout-form já havia disparado (para cartão,
    // a chamada em checkout-form.tsx:284; para PIX, polling em checkout-form.tsx:181).
    // Isso resultava em 2x client + 1x CAPI, inflando Purchase no Meta Ads Manager.
    // Agora usamos sessionStorage como "já disparou" (1-time guard) — PixelFireBackup
    // só dispara se o checkout-form não tiver disparado (e.g., redirect direto sem
    // passar pelo form).
    const guardKey = `flowyn_pixel_fired_${orderId}`
    try {
      if (sessionStorage.getItem(guardKey) === '1') {
        return
      }
      sessionStorage.setItem(guardKey, '1')
    } catch {
      // sessionStorage indisponível (modo privado) — prossegue sem o guard
    }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, orderId, metaSig, googleSig, tiktokSig])

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
