'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { isSafeRedirectPath, isValidCpfCnpj, isValidEmail, isValidFullName, isValidPassword, isValidPhone } from '@/lib/validation'
import { hashIdentifier } from '@/lib/hash'

function redirectWithParams(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params)
  redirect(`${path}?${query.toString()}`)
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
  }

  if (!isValidEmail(data.email) || !isValidPassword(data.password)) {
    redirectWithParams('/login', { error: 'E-mail ou senha inválidos' })
  }

  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const admin = createAdminClient()
  const { data: allowed } = await admin.rpc('consume_rate_limit', {
    requested_bucket: 'login',
    requested_identifier_hash: await hashIdentifier(`${ip}:${data.email}`),
    max_requests: 8,
    window_seconds: 300,
  })
  if (allowed === false) {
    redirectWithParams('/login', { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' })
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirectWithParams('/login', { error: 'E-mail ou senha inválidos' })
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
    options: {
      data: {
        full_name: String(formData.get('full_name') || '').trim(),
        role: 'producer',
      },
    },
  }

  if (!isValidFullName(data.options.data.full_name) || !isValidEmail(data.email) || !isValidPassword(data.password)) {
    redirectWithParams('/register', { error: 'Preencha nome, e-mail e senha válidos.' })
  }

  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const admin = createAdminClient()

  const { data: signupAllowed } = await admin.rpc('consume_rate_limit', {
    requested_bucket: 'signup',
    requested_identifier_hash: await hashIdentifier(ip),
    max_requests: 3,
    window_seconds: 600,
  })
  if (signupAllowed === false) {
    redirectWithParams('/register', { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' })
  }

  const { data: signUpData, error } = await supabase.auth.signUp(data)

  if (error || !signUpData.user) {
    redirectWithParams('/register', { error: 'Não foi possível criar a conta. Tente novamente.' })
  }

  redirectWithParams('/login', { success: 'registered' })
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = String(formData.get('email') || '').trim()
  const appUrl = getAppUrl()

  if (!isValidEmail(email)) {
    redirectWithParams('/forgot-password', { error: 'E-mail inválido. Verifique e tente novamente.' })
  }

  const headerStore = await headers()
  const ip = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const admin = createAdminClient()
  const { data: allowed } = await admin.rpc('consume_rate_limit', {
    requested_bucket: 'forgot_password',
    requested_identifier_hash: await hashIdentifier(`${ip}:${email}`),
    max_requests: 3,
    window_seconds: 300,
  })
  if (allowed === false) {
    redirectWithParams('/forgot-password', { error: 'Aguarde antes de solicitar outro link.' })
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirectWithParams('/forgot-password', { error: 'Não foi possível enviar o e-mail. Verifique o endereço informado.' })
  }

  redirectWithParams('/forgot-password', { success: 'email_sent' })
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirm_password') || '')
  const next = String(formData.get('next') || '')
  const safeNext = isSafeRedirectPath(next) ? next : ''

  if (password !== confirmPassword) {
    redirectWithParams('/reset-password', { error: 'As senhas não coincidem' })
  }

  if (!isValidPassword(password)) {
    redirectWithParams('/reset-password', { error: 'A senha deve ter no mínimo 6 caracteres' })
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirectWithParams('/reset-password', { error: 'Link expirado ou inválido. Solicite um novo e-mail.' })
  }

  if (safeNext) {
    redirect(safeNext)
  }

  redirectWithParams('/login', { success: 'password_reset' })
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const full_name = String(formData.get('full_name') || '').trim()
  const document_number = String(formData.get('document_number') || '').trim()
  const phone = String(formData.get('phone') || '').trim()

  if (full_name && !isValidFullName(full_name)) {
    redirectWithParams('/dashboard/settings/profile', { error: 'Nome inválido.' })
  }
  if (document_number && !isValidCpfCnpj(document_number)) {
    redirectWithParams('/dashboard/settings/profile', { error: 'CPF/CNPJ inválido.' })
  }
  if (phone && !isValidPhone(phone)) {
    redirectWithParams('/dashboard/settings/profile', { error: 'Telefone inválido.' })
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: full_name || null,
      document_number: document_number || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    redirectWithParams('/dashboard/settings/profile', { error: 'Não foi possível salvar as alterações' })
  }

  revalidatePath('/dashboard', 'layout')
  redirectWithParams('/dashboard/settings/profile', { success: 'profile_updated' })
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirm_password') || '')

  if (password !== confirmPassword) {
    redirectWithParams('/dashboard/settings/profile', { error: 'As senhas não coincidem', tab: 'security' })
  }

  if (!isValidPassword(password)) {
    redirectWithParams('/dashboard/settings/profile', { error: 'A senha deve ter no mínimo 6 caracteres', tab: 'security' })
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirectWithParams('/dashboard/settings/profile', { error: 'Não foi possível alterar a senha', tab: 'security' })
  }

  redirectWithParams('/dashboard/settings/profile', { success: 'password_changed', tab: 'security' })
}

