"use server"

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { normalizeCheckoutConfig } from '@/lib/checkout-customization'

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

export async function publishCheckout(productId: string, rawConfig: unknown) {
  const { supabase, product } = await assertOwner(productId)
  const config = normalizeCheckoutConfig(rawConfig, product)
  const now = new Date().toISOString()

  await supabase.from('checkout_customizations').upsert({
    product_id: productId,
    draft_config: config,
    published_config: config,
    published_at: now,
    updated_at: now,
  }, { onConflict: 'product_id' })

  revalidatePath(`/dashboard/products/${productId}/checkout-editor`)
  revalidatePath('/checkout/[id]', 'page')
}
