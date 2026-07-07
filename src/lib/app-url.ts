const FALLBACK_PRODUCTION_URL = 'https://flowyn.com.br'

function normalizeUrl(value: string) {
  const trimmed = value.trim().replace(/\/$/, '')
  if (!trimmed) return ''
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function getAppUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const url = normalizeUrl(candidate)
    if (url && !url.includes('localhost')) return url
  }

  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL não está configurado em produção.')
  }

  return FALLBACK_PRODUCTION_URL
}
