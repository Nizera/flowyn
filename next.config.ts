import type { NextConfig } from 'next'

const cspScriptSrc = process.env.NODE_ENV === 'development'
  ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https://*.supabase.co; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.resend.com https://api-sandbox.asaas.com https://api.asaas.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';"
  : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob: https://*.supabase.co; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.resend.com https://api-sandbox.asaas.com https://api.asaas.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none';"

const nextConfig: NextConfig = {
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
