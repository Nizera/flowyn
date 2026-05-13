import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not defined')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as any,
  typescript: true,
})

// Flowyn Fee Configuration (The lowest in the market!)
export const PLATFORM_FEE_PERCENT = 3.9
export const PLATFORM_FEE_FIXED = 100 // em centavos (R$ 1,00)

/**
 * Calcula a taxa da Flowyn para uma transação.
 */
export function calculateFlowynFee(amountInCents: number) {
  const percentFee = Math.round(amountInCents * (PLATFORM_FEE_PERCENT / 100))
  return percentFee + PLATFORM_FEE_FIXED
}

/**
 * Calcula o split entre Plataforma, Produtor e Afiliado.
 */
export function calculateSplit(
  totalAmount: number, // em centavos
  commissionRate: number // porcentagem do afiliado (ex: 50)
) {
  const platformFee = calculateFlowynFee(totalAmount)
  
  // O valor que sobra para dividir entre Produtor e Afiliado após a taxa da Flowyn
  const amountToSplit = totalAmount - platformFee
  
  const affiliateShare = Math.round(amountToSplit * (commissionRate / 100))
  const producerShare = amountToSplit - affiliateShare

  return {
    platformFee,
    affiliateShare,
    producerShare,
  }
}

/**
 * Cria um link de onboarding para uma conta Connect Express.
 */
export async function createOnboardingLink(accountId: string, returnUrl: string, refreshUrl: string) {
  return await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  })
}

/**
 * Cria um link para o Dashboard Express do usuário.
 */
export async function createLoginLink(accountId: string) {
  return await stripe.accounts.createLoginLink(accountId)
}
