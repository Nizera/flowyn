'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { encryptApiKey } from '@/lib/encryption'

export async function createPixel(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const name = formData.get('name') as string
  const platform = formData.get('platform') as string
  const pixel_id = formData.get('pixel_id') as string
  // CAPI token opcional — só usado para platform=meta. Encriptado antes de salvar.
  const capi_access_token = (formData.get('capi_access_token') as string | null)?.trim() || ''

  if (!name || !platform || !pixel_id) return { error: 'Preencha todos os campos' }

  const pixelPatterns: Record<string, RegExp> = {
    meta: /^\d{10,20}$/,
    google: /^AW-\d+$/,
    tiktok: /^[A-Z0-9]{10,30}$/i,
  }
  const pattern = pixelPatterns[platform]
  if (pattern && !pattern.test(pixel_id)) {
    return { error: `Formato de Pixel ID inválido para ${platform}` }
  }

  // CAPI token só faz sentido para Meta. Defensive: clear se plataforma != meta.
  const encryptedCapiToken = (platform === 'meta' && capi_access_token)
    ? encryptApiKey(capi_access_token)
    : null

  const { error } = await supabase.from('pixels').insert({
    user_id: user.id,
    name,
    platform,
    pixel_id: encryptApiKey(pixel_id),
    capi_access_token: encryptedCapiToken,
    is_active: true,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/pixels')
  return { success: true }
}

export async function togglePixel(pixelId: string, isActive: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('pixels')
    .update({ is_active: isActive })
    .eq('id', pixelId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/pixels')
}

// Atualiza apenas o token CAPI de um pixel existente ( META Conversions API ).
// Aceita string vazia para limpar. Retorna { success: true } ou { error: string }.
export async function updatePixelCapiToken(pixelId: string, capiToken: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const token = (capiToken || '').trim()
  const encrypted = token ? encryptApiKey(token) : null

  const { error } = await supabase
    .from('pixels')
    .update({ capi_access_token: encrypted })
    .eq('id', pixelId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/pixels')
  return { success: true, has_token: Boolean(token) }
}

export async function deletePixel(pixelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('pixels')
    .delete()
    .eq('id', pixelId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/pixels')
}

export async function addPlanPixel(planId: string, pixelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: plan } = await supabase
    .from('plans')
    .select('id, product:products!inner(owner_id)')
    .eq('id', planId)
    .single()
  if (!plan) return { error: 'Plano não encontrado' }
  const productOwner = Array.isArray(plan.product) ? plan.product[0]?.owner_id : (plan.product as Record<string, string>)?.owner_id
  if (productOwner !== user.id) {
    return { error: 'Acesso negado' }
  }

  const { data: pixel } = await supabase
    .from('pixels')
    .select('id')
    .eq('id', pixelId)
    .eq('user_id', user.id)
    .single()
  if (!pixel) return { error: 'Pixel não encontrado' }

  const { error } = await supabase.from('plan_pixels').insert({ plan_id: planId, pixel_id: pixelId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/products')
  return { success: true }
}

export async function removePlanPixel(planPixelId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const { data: planPixel } = await supabase
    .from('plan_pixels')
    .select('id, plan:plans!inner(product:products!inner(owner_id))')
    .eq('id', planPixelId)
    .single()
  if (!planPixel) return { error: 'Registro não encontrado' }
  const planData = Array.isArray(planPixel.plan) ? planPixel.plan[0] : planPixel.plan
  const rawProduct = planData ? (planData as Record<string, unknown>).product : null
  const productData = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct
  const owner = productData ? (productData as Record<string, string>)?.owner_id : null
  if (owner !== user.id) {
    return { error: 'Acesso negado' }
  }

  const { error } = await supabase.from('plan_pixels').delete().eq('id', planPixelId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/products')
  return { success: true }
}
