import 'server-only'

export type CheckoutCustomizationConfig = {
  primaryColor: string
  backgroundColor: string
  buttonText: string
  headline: string
  subheadline: string
  securityText: string
  guaranteeText: string
  bannerImageUrl: string
  mockupImageUrl: string
  orderBumpImageUrl: string
  benefits: string[]
  testimonials: Array<{ name: string; text: string }>
  faq: Array<{ question: string; answer: string }>
  urgencyPhrases: string[]
  blocks: {
    banner: boolean
    benefits: boolean
    testimonials: boolean
    faq: boolean
    guarantee: boolean
  }
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i

export function defaultCheckoutConfig(product?: {
  name?: string | null
  short_description?: string | null
  description?: string | null
  checkout_banner_url?: string | null
  logo_url?: string | null
  order_bump_image_url?: string | null
}): CheckoutCustomizationConfig {
  return {
    primaryColor: '#f97316',
    backgroundColor: '#ffffff',
    buttonText: 'Finalizar compra',
    headline: product?.name ? `Garanta seu acesso ao ${product.name}` : 'Garanta seu acesso agora',
    subheadline: product?.short_description || product?.description || 'Pagamento seguro e acesso liberado após confirmação.',
    securityText: 'Pagamento seguro via Asaas',
    guaranteeText: 'Acesso enviado automaticamente após a confirmação do pagamento.',
    bannerImageUrl: product?.checkout_banner_url || '',
    mockupImageUrl: product?.logo_url || '',
    orderBumpImageUrl: product?.order_bump_image_url || '',
    benefits: ['Acesso imediato', 'Checkout seguro', 'Suporte do produtor'],
    testimonials: [],
    faq: [],
    urgencyPhrases: ['Oferta por tempo limitado', 'Garanta seu acesso agora', 'Acesso imediato apos a compra'],
    blocks: {
      banner: true,
      benefits: true,
      testimonials: false,
      faq: false,
      guarantee: true,
    },
  }
}

function safeText(value: unknown, fallback = '') {
  return String(value || fallback).replace(/[<>]/g, '').slice(0, 500)
}

function safeUrl(value: unknown) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (url.startsWith('https://') || url.startsWith('/')) return url.slice(0, 1000)
  return ''
}

function safeStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback
  return value.map(item => safeText(item)).filter(Boolean).slice(0, 8)
}

export function normalizeCheckoutConfig(input: unknown, product?: Parameters<typeof defaultCheckoutConfig>[0]): CheckoutCustomizationConfig {
  const defaults = defaultCheckoutConfig(product)
  const data = (input && typeof input === 'object' ? input : {}) as Partial<CheckoutCustomizationConfig>
  const blocks = (data.blocks && typeof data.blocks === 'object' ? data.blocks : {}) as Partial<CheckoutCustomizationConfig['blocks']>

  return {
    primaryColor: HEX_COLOR.test(String(data.primaryColor || '')) ? String(data.primaryColor) : defaults.primaryColor,
    backgroundColor: HEX_COLOR.test(String(data.backgroundColor || '')) ? String(data.backgroundColor) : defaults.backgroundColor,
    buttonText: safeText(data.buttonText, defaults.buttonText),
    headline: safeText(data.headline, defaults.headline),
    subheadline: safeText(data.subheadline, defaults.subheadline),
    securityText: safeText(data.securityText, defaults.securityText),
    guaranteeText: safeText(data.guaranteeText, defaults.guaranteeText),
    bannerImageUrl: safeUrl(data.bannerImageUrl) || defaults.bannerImageUrl,
    mockupImageUrl: safeUrl(data.mockupImageUrl) || defaults.mockupImageUrl,
    orderBumpImageUrl: safeUrl(data.orderBumpImageUrl) || defaults.orderBumpImageUrl,
    benefits: safeStringArray(data.benefits, defaults.benefits),
    testimonials: Array.isArray(data.testimonials)
      ? data.testimonials.map(item => ({
          name: safeText((item as { name?: unknown })?.name),
          text: safeText((item as { text?: unknown })?.text),
        })).filter(item => item.name && item.text).slice(0, 6)
      : defaults.testimonials,
    faq: Array.isArray(data.faq)
      ? data.faq.map(item => ({
          question: safeText((item as { question?: unknown })?.question),
          answer: safeText((item as { answer?: unknown })?.answer),
        })).filter(item => item.question && item.answer).slice(0, 8)
      : defaults.faq,
    urgencyPhrases: safeStringArray(data.urgencyPhrases, defaults.urgencyPhrases),
    blocks: {
      banner: blocks.banner ?? defaults.blocks.banner,
      benefits: blocks.benefits ?? defaults.blocks.benefits,
      testimonials: blocks.testimonials ?? defaults.blocks.testimonials,
      faq: blocks.faq ?? defaults.blocks.faq,
      guarantee: blocks.guarantee ?? defaults.blocks.guarantee,
    },
  }
}
