"use server"

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { normalizeCheckoutConfig } from '@/lib/checkout-customization'
import { checkPlanLimit } from '@/lib/subscription'

async function assertOwner(productId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: product } = await supabase
    .from('products')
    .select('id, owner_id, name, short_description, description, checkout_banner_url, logo_url, order_bump_image_url')
    .eq('id', productId)
    .eq('owner_id', user.id)
    .single()

  if (!product) redirect('/dashboard/products')
  return { supabase, user, product }
}

export async function saveCheckoutDraft(productId: string, rawConfig: unknown) {
  const { supabase, product } = await assertOwner(productId)
  const config = normalizeCheckoutConfig(rawConfig, product)

  await supabase.from('checkout_customizations').upsert({
    product_id: productId,
    draft_config: config,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'product_id' })

  revalidatePath(`/dashboard/products/${productId}/checkout-editor`)
}

export async function publishCheckout(productId: string, rawConfig: unknown): Promise<{ success?: boolean; error?: string }> {
  const { supabase, user, product } = await assertOwner(productId)
  const config = normalizeCheckoutConfig(rawConfig, product)
  const now = new Date().toISOString()

  const { data: existing } = await supabase
    .from('checkout_customizations')
    .select('published_at')
    .eq('product_id', productId)
    .maybeSingle()

  const alreadyPublished = existing?.published_at != null

  if (!alreadyPublished) {
    const limit = await checkPlanLimit(user.id, 'checkouts')
    if (!limit.allowed) {
      return { error: `Voce atingiu o limite de ${limit.max} checkout(s) publicado(s) do plano gratuito. Atualize para o plano Pro para publicar mais.` }
    }
  }

  await supabase.from('checkout_customizations').upsert({
    product_id: productId,
    draft_config: config,
    published_config: config,
    published_at: now,
    updated_at: now,
  }, { onConflict: 'product_id' })

  revalidatePath(`/dashboard/products/${productId}/checkout-editor`)
  revalidatePath('/checkout/[id]', 'page')

  return { success: true }
}
