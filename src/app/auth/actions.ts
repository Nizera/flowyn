'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

// ─── LOGIN ───────────────────────────────────────────────────────────────────
export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=E-mail ou senha inválidos')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// ─── SIGNUP ──────────────────────────────────────────────────────────────────
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: {
        full_name: formData.get('full_name') as string,
        role: 'producer',
      }
    }
  }

  const { data: signUpData, error } = await supabase.auth.signUp(data)

  if (error || !signUpData.user) {
    redirect('/register?error=Não foi possível criar a conta. Tente novamente.')
  }

  redirect('/login?success=registered')
}

// ─── SIGNOUT ─────────────────────────────────────────────────────────────────
export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
export async function forgotPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirect('/forgot-password?error=Não foi possível enviar o e-mail. Verifique o endereço informado.')
  }

  redirect('/forgot-password?success=email_sent')
}

// ─── RESET PASSWORD (via link do e-mail) ─────────────────────────────────────
export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string
  const next = String(formData.get('next') || '')
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : ''

  if (password !== confirmPassword) {
    redirect('/reset-password?error=As senhas não coincidem')
  }

  if (password.length < 6) {
    redirect('/reset-password?error=A senha deve ter no mínimo 6 caracteres')
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect('/reset-password?error=Link expirado ou inválido. Solicite um novo e-mail.')
  }

  if (safeNext) {
    redirect(safeNext)
  }

  redirect('/login?success=password_reset')
}

// ─── UPDATE PROFILE (dados pessoais) ─────────────────────────────────────────
export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const full_name = formData.get('full_name') as string
  const document_number = formData.get('document_number') as string
  const phone = formData.get('phone') as string

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name,
      document_number: document_number || null,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    redirect('/dashboard/settings/profile?error=Não foi possível salvar as alterações')
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard/settings/profile?success=profile_updated')
}

// ─── CHANGE PASSWORD (usuário logado) ────────────────────────────────────────
export async function changePassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (password !== confirmPassword) {
    redirect('/dashboard/settings/profile?error=As senhas não coincidem&tab=security')
  }

  if (password.length < 6) {
    redirect('/dashboard/settings/profile?error=A senha deve ter no mínimo 6 caracteres&tab=security')
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect('/dashboard/settings/profile?error=Não foi possível alterar a senha&tab=security')
  }

  redirect('/dashboard/settings/profile?success=password_changed&tab=security')
}
