'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { checkPlanLimit } from '@/lib/subscription'

export async function toggleProductActive(productId: string): Promise<{ success: boolean; error?: string; allowed?: boolean; current?: number; max?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  // Verifica se o produto pertence ao user
  const { data: product } = await supabase
    .from('products')
    .select('id, is_active, owner_id')
    .eq('id', productId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!product) return { success: false, error: 'Produto nao encontrado' }

  // Se está desabilitando, pode sempre
  if (product.is_active) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', productId)

    if (error) return { success: false, error: error.message }
    revalidatePath('/dashboard/products')
    return { success: true }
  }

  // Se está habilitando, verifica o limite do plano
  const limit = await checkPlanLimit(user.id, 'products')
  if (!limit.allowed) {
    return { success: false, error: `Limite do plano atingido (${limit.current}/${limit.max})`, allowed: false, current: limit.current, max: limit.max }
  }

  const { error } = await supabase
    .from('products')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', productId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/products')
  return { success: true }
}
