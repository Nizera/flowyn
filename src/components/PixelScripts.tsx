'use client'

import Script from 'next/script'
import { useEffect, useMemo } from 'react'
import { isValidPixelId } from '@/lib/pixel-id-validation'

interface PixelConfig {
  platform: 'meta' | 'google' | 'tiktok'
  pixel_id: string
}

interface Props {
  pixels: PixelConfig[]
}

type FbqFunction = (event: string, ...args: unknown[]) => void
type GtagFunction = (...args: unknown[]) => void
interface TiktokTtq {
  track: (event: string, payload?: Record<string, unknown>) => void
  load: (id: string) => void
  page: () => void
}

// Expose global purchase fire function for checkout-form to call
declare global {
  interface Window {
    firePixelPurchase?: (amount: number, eventId?: string) => void
    fbq?: FbqFunction
    gtag?: GtagFunction
    ttq?: TiktokTtq
    dataLayer?: unknown[]
  }
}

export function PixelScripts({ pixels }: Props) {
  // CORREÇÃO W1 (auditoria tracking): valida cada pixel_id contra um regex estrito
  // antes de injetar em strings de JS. IDs inválidos são descartados silenciosamente
  // para não quebrar o carregamento de pixels válidos na mesma página.
  // CORREÇÃO W2 (auditoria tracking): useMemo para estabilizar as referências de
  // array e evitar que o useEffect re-rode a cada render do parent.
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

  // Memoize a string signature to detect actual changes (arrays come from props
  // with new refs every render even when contents are identical).
  const metaSig = useMemo(() => metaPixels.map(p => p.pixel_id).join(','), [metaPixels])
  const googleSig = useMemo(() => googlePixels.map(p => p.pixel_id).join(','), [googlePixels])
  const tiktokSig = useMemo(() => tiktokPixels.map(p => p.pixel_id).join(','), [tiktokPixels])

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
    window.firePixelPurchase = (amount: number, eventId?: string) => {
      const eventData = { value: amount, currency: 'BRL', ...(eventId ? { eventID: eventId } : {}) }

      // Meta Purchase
      if (window.fbq) {
        window.fbq('track', 'Purchase', eventData)
      }

      // Google conversion
      if (window.gtag) {
        googlePixels.forEach(p => {
          window.gtag!('event', 'conversion', {
            send_to: p.pixel_id,
            value: amount,
            currency: 'BRL',
            ...(eventId ? { transaction_id: eventId } : {}),
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
  }, [metaSig, googleSig, tiktokSig])

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
