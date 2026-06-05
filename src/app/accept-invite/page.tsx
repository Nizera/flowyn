'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Eye, EyeOff, Loader2, Lock } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

function AcceptInviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [productName, setProductName] = useState('')
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) setSessionReady(true)
    })

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sessionReady || !orderId) return

    const supabase = createClient()
    supabase
      .from('orders')
      .select('id, product:products(name)')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        const product = data?.product as any
        if (product?.name) setProductName(product.name)
      })
  }, [sessionReady, orderId])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas nao coincidem.')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError('Erro ao definir a senha: ' + updateError.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/learn'), 2500)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-12 text-center shadow-2xl">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="mb-2 text-2xl font-extrabold text-slate-900">Conta ativada com sucesso!</h1>
          <p className="mb-6 text-slate-500">Redirecionando para sua area do aluno...</p>
          <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-green-500 animate-[progress_2.5s_linear_forwards]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-10 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-black">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Crie sua senha</h1>
          <p className="mt-2 text-sm text-slate-500">
            {productName ? `Defina uma senha para acessar ${productName}` : 'Bem-vindo! Defina uma senha segura para acessar sua conta.'}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
            <CheckCircle className="h-3.5 w-3.5" />
            Voce sera redirecionado apos ativar
          </div>
        </div>

        <form onSubmit={handleSetPassword} className="space-y-5">
          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm text-red-600">{error}</div>}

          <PasswordField
            label="Nova senha"
            value={password}
            visible={showPassword}
            onChange={setPassword}
            onToggle={() => setShowPassword(v => !v)}
          />

          <PasswordField
            label="Confirmar senha"
            value={confirmPassword}
            visible={showPassword}
            onChange={setConfirmPassword}
            onToggle={() => setShowPassword(v => !v)}
          />

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-black py-4 font-bold text-white transition hover:bg-slate-800 disabled:opacity-70"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5" />}
            {loading ? 'Ativando...' : 'Ativar minha conta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function PasswordField({
  label,
  value,
  visible,
  onChange,
  onToggle,
}: {
  label: string
  value: string
  visible: boolean
  onChange: (value: string) => void
  onToggle: () => void
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-black focus:bg-white"
          placeholder="Minimo 6 caracteres"
          required
        />
        <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Carregando...</div>}>
      <AcceptInviteForm />
    </Suspense>
  )
}
