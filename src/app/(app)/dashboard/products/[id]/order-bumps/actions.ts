'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

type OrderBumpInput = {
  title: string
  description?: string
  image_url?: string
  price: number
  original_price?: number
  file_paths?: string[]
  plan_ids?: string[]
}

export async function createOrderBump(productId: string, data: OrderBumpInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: product } = await supabase
    .from('products')
    .select('owner_id')
    .eq('id', productId)
    .single()

  if (!product || product.owner_id !== user.id) throw new Error('Produto não encontrado')

  const { error } = await supabase.from('product_order_bumps').insert({
    product_id: productId,
    title: data.title,
    description: data.description || '',
    image_url: data.image_url || '',
    price: data.price,
    original_price: data.original_price || 0,
    file_paths: data.file_paths || [],
    plan_ids: data.plan_ids || [],
  })

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/products/${productId}/order-bumps`)
}

export async function updateOrderBump(id: string, productId: string, data: OrderBumpInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: product } = await supabase
    .from('products')
    .select('owner_id')
    .eq('id', productId)
    .single()

  if (!product || product.owner_id !== user.id) throw new Error('Produto não encontrado')

  const { error } = await supabase
    .from('product_order_bumps')
    .update({
      title: data.title,
      description: data.description || '',
      image_url: data.image_url || '',
      price: data.price,
      original_price: data.original_price || 0,
      file_paths: data.file_paths || [],
      plan_ids: data.plan_ids || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('product_id', productId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/products/${productId}/order-bumps`)
}

export async function deleteOrderBump(id: string, productId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { data: product } = await supabase
    .from('products')
    .select('owner_id')
    .eq('id', productId)
    .single()

  if (!product || product.owner_id !== user.id) throw new Error('Produto não encontrado')

  const { error } = await supabase
    .from('product_order_bumps')
    .delete()
    .eq('id', id)
    .eq('product_id', productId)

  if (error) throw new Error(error.message)
  revalidatePath(`/dashboard/products/${productId}/order-bumps`)
}
