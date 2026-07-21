/**
 * CORREÇÃO W1 (auditoria tracking): pixel IDs eram interpolados diretamente em
 * strings de JS via template literals, permitindo XSS se um produtor injetasse
 * algo como `'); alert(1); fbq('init','x`. Agora validamos cada ID contra um
 * regex estrito ANTES de injetar no script.
 */

const META_PIXEL_RE = /^\d{8,20}$/
const GOOGLE_ADS_RE = /^(AW|UA|G|GT)-[A-Za-z0-9_-]{4,40}$/
const TIKTOK_RE = /^[A-Z0-9]{16,32}$/

export function isValidMetaPixelId(id: string): boolean {
  return META_PIXEL_RE.test(id)
}

export function isValidGoogleAdsId(id: string): boolean {
  return GOOGLE_ADS_RE.test(id)
}

export function isValidTiktokPixelId(id: string): boolean {
  return TIKTOK_RE.test(id)
}

export type PixelPlatform = 'meta' | 'google' | 'tiktok'

export function isValidPixelId(platform: PixelPlatform, id: string): boolean {
  if (platform === 'meta') return isValidMetaPixelId(id)
  if (platform === 'google') return isValidGoogleAdsId(id)
  if (platform === 'tiktok') return isValidTiktokPixelId(id)
  return false
}
