'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updatePlanAction(productId: string, planId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Unauthorized' }

  // Verify ownership
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('owner_id', user.id)
    .single()

  if (!product) return { success: false, error: 'Product not found' }

  const name = formData.get('name') as string
  const price = formData.get('price') as string
  const plan_identifier = formData.get('plan_identifier') as string

  if (!name || !price) return { success: false, error: 'Missing required fields' }

  const { error } = await supabase
    .from('plans')
    .update({
      name,
      price: parseFloat(price),
      plan_identifier: plan_identifier || null
    })
    .eq('id', planId)
    .eq('product_id', productId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/products/${productId}/plans`)
  return { success: true }
}
