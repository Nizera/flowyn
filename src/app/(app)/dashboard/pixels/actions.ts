'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPixel(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  const name = formData.get('name') as string
  const platform = formData.get('platform') as string
  const pixel_id = formData.get('pixel_id') as string

  if (!name || !platform || !pixel_id) return { error: 'Preencha todos os campos' }

  const { error } = await supabase.from('pixels').insert({
    user_id: user.id,
    name,
    platform,
    pixel_id,
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
  await supabase.from('plan_pixels').insert({ plan_id: planId, pixel_id: pixelId })
  revalidatePath('/dashboard/products')
}

export async function removePlanPixel(planPixelId: string) {
  const supabase = await createClient()
  await supabase.from('plan_pixels').delete().eq('id', planPixelId)
  revalidatePath('/dashboard/products')
}

export async function addAffiliationPixel(affiliationId: string, pixelId: string) {
  const supabase = await createClient()
  await supabase.from('affiliation_pixels').insert({ affiliation_id: affiliationId, pixel_id: pixelId })
  revalidatePath('/dashboard/affiliations')
}

export async function removeAffiliationPixel(affPixelId: string) {
  const supabase = await createClient()
  await supabase.from('affiliation_pixels').delete().eq('id', affPixelId)
  revalidatePath('/dashboard/affiliations')
}
