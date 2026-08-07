import type { NextConfig } from 'next'

// CORREÇÃO C1 (auditoria tracking): CSP liberava apenas 'self' e 'unsafe-inline' em script-src,
// bloqueando pixels de Meta (connect.facebook.net), Google (googletagmanager.com) e TikTok
// (analytics.tiktok.com) em produção. Adicionados os domínios necessários em script-src,
// connect-src e img-src. Unsafe-inline mantido por enquanto porque os pixels são injetados
// via next/script (inline) — migração para nonce fica como follow-up.
// NOTA: connect-src inclui *.run.app e *.on.aws porque o Meta CAPI relay usa
// endpoints dinâmicos em Google Cloud Run e AWS (ex: mpc-prod-*.run.app).
// Não é possível fixar hostnames específicos porque o Meta rotaciona esses endpoints.
const cspScriptSrc = process.env.NODE_ENV === 'development'
  ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com https://www.googleadservices.com https://us-assets.i.posthog.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: https://www.facebook.com https://analytics.tiktok.com; media-src 'self' blob: https://*.supabase.co https://*.supabase.in; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.resend.com https://api-sandbox.asaas.com https://api.asaas.com https://*.facebook.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://analytics.tiktok.com https://us.i.posthog.com https://static.cloudflareinsights.com https://*.run.app https://*.on.aws; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none';"
  : "default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com https://analytics.tiktok.com https://www.googleadservices.com https://us-assets.i.posthog.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: https://www.facebook.com https://analytics.tiktok.com; media-src 'self' blob: https://*.supabase.co https://*.supabase.in; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.facebook.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.resend.com https://api-sandbox.asaas.com https://api.asaas.com https://*.facebook.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://analytics.tiktok.com https://us.i.posthog.com https://static.cloudflareinsights.com https://*.run.app https://*.on.aws; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none';"

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
  async headers() {
    return [
      {
        source: '/api/platform/subscription',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/checkout/asaas',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private, max-age=0' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/checkout/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: cspScriptSrc,
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: cspScriptSrc,
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
    ]
  },
}

export default nextConfig;
