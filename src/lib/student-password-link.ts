import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAppUrl } from '@/lib/app-url'

export async function findAuthUserIdByEmail(supabase: SupabaseClient, email: string) {
  const targetEmail = email.trim().toLowerCase()

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) return null

    const matchedUser = data.users.find(user => user.email?.toLowerCase() === targetEmail)
    if (matchedUser) return matchedUser.id
    if (data.users.length < 1000) break
  }

  return null
}

export async function createStudentPasswordSetupUrl(
  supabase: SupabaseClient,
  email: string,
  productId: string
) {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  const tokenHash = data?.properties?.hashed_token
  if (error || !tokenHash) return null

  const productPath = `/learn/${productId}`
  const params = new URLSearchParams({
    token_hash: tokenHash,
    next: productPath,
  })

  return `${getAppUrl()}/auth/recovery?${params.toString()}`
}
