import { PixelScripts } from '@/components/PixelScripts'

const PLATFORM_PIXELS = [
  { platform: 'google' as const, pixel_id: 'AW-11452527910' },
]

export function GlobalPixels() {
  return <PixelScripts pixels={PLATFORM_PIXELS} />
}
