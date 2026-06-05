"use client"

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'
import { login, signup } from '@/app/auth/actions'

interface ClientAuthPanelProps {
  initialError?: string
  initialType?: string
  initialSuccess?: string
}

export function ClientAuthPanel({ initialError, initialType, initialSuccess }: ClientAuthPanelProps) {
  const [isLogin, setIsLogin] = useState(initialType !== 'register')

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: 'url("/noise.png")', backgroundRepeat: 'repeat' }}
      />
      <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00e88a]/5 blur-[120px] pointer-events-none" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#111111] shadow-2xl md:grid-cols-[1fr_420px]">
        <section className="hidden min-h-[640px] flex-col justify-between border-r border-white/10 bg-[#050505] p-10 md:flex">
          <Link href="/" className="inline-flex">
            <img src="/logo2.png" alt="Flowyn" className="h-20 w-auto" />
          </Link>
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#00e88a]/25 bg-[#00e88a]/10 px-3 py-1 text-xs font-bold text-[#00e88a]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Checkout para produtores
            </div>
            <h1 className="max-w-md text-4xl font-black leading-tight text-white">
              Venda infoprodutos sem taxa Flowyn por venda.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/50">
              Crie produtos, publique checkouts, conecte a Asaas e acompanhe suas vendas em um painel simples.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-white/50">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <Zap className="mb-2 h-4 w-4 text-[#00e88a]" />
              7 dias gratis
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <ShieldCheck className="mb-2 h-4 w-4 text-[#00e88a]" />
              Checkout seguro
            </div>
          </div>
        </section>

        <section className="p-6 md:p-10">
          <div className="mb-8 flex rounded-2xl border border-white/10 bg-[#0a0a0a] p-1">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${isLogin ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${!isLogin ? 'bg-white/10 text-white' : 'text-white/45 hover:text-white'}`}
            >
              Criar conta
            </button>
          </div>

          <div className="md:hidden">
            <Link href="/" className="mb-6 inline-flex">
              <img src="/logo2.png" alt="Flowyn" className="h-16 w-auto" />
            </Link>
          </div>

          {isLogin ? (
            <form action={login} className="space-y-5">
              <div>
                <h2 className="text-3xl font-black text-white">Acesse sua conta</h2>
                <p className="mt-2 text-sm text-white/50">Entre para acompanhar produtos, vendas e alunos.</p>
              </div>

              {initialSuccess === 'registered' && (
                <SuccessBox title="Conta criada com sucesso!" text="Verifique seu e-mail para confirmar a conta." />
              )}
              {initialSuccess === 'email_confirmed' && (
                <SuccessBox title="E-mail confirmado!" text="Sua conta esta ativa. Faca login para acessar." />
              )}
              {initialSuccess === 'password_reset' && (
                <SuccessBox title="Senha redefinida!" text="Use sua nova senha para entrar." />
              )}
              {initialError && <ErrorBox text={initialError} />}

              <Field id="email_login" label="E-mail" name="email" type="email" placeholder="voce@email.com" />
              <Field id="password_login" label="Senha" name="password" type="password" placeholder="********" />

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/60">
                  <input type="checkbox" className="h-4 w-4 rounded border-white/20 bg-[#0a0a0a] text-[#00e88a] focus:ring-[#00e88a]" />
                  Lembrar de mim
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-white/50 transition hover:text-white">Esqueceu a senha?</Link>
              </div>

              <SubmitButton label="Entrar na Flowyn" />
            </form>
          ) : (
            <form action={signup} className="space-y-5">
              <div>
                <h2 className="text-3xl font-black text-white">Crie sua conta gratis</h2>
                <p className="mt-2 text-sm text-white/50">Comece como produtor e publique seu primeiro checkout.</p>
              </div>

              {!isLogin && initialError && <ErrorBox text={initialError} />}

              <Field id="full_name" label="Nome completo" name="full_name" type="text" placeholder="Joao da Silva" />
              <Field id="email_register" label="E-mail" name="email" type="email" placeholder="voce@email.com" />
              <Field id="password_register" label="Senha" name="password" type="password" placeholder="********" />

              <SubmitButton label="Criar conta gratis" light />

              <p className="text-center text-xs text-white/30">
                Ao criar sua conta voce concorda com os nossos <a href="#" className="underline hover:text-white/60">Termos de Uso</a>.
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  )
}

function Field({ id, label, name, type, placeholder }: { id: string; label: string; name: string; type: string; placeholder: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-white/80">{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        required
        className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-white placeholder-white/30 transition-all focus:border-[#00e88a] focus:outline-none focus:ring-1 focus:ring-[#00e88a]"
        placeholder={placeholder}
      />
    </div>
  )
}

function SubmitButton({ label, light = false }: { label: string; light?: boolean }) {
  return (
    <button
      type="submit"
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all ${light ? 'bg-white text-black hover:bg-gray-200' : 'bg-[#00e88a] text-black shadow-[0_0_20px_rgba(0,232,138,0.3)] hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(0,232,138,0.5)]'}`}
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </button>
  )
}

function SuccessBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#00e88a]/30 bg-[#00e88a]/10 p-4 text-sm text-[#00e88a]">
      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-[#00e88a]/70">{text}</p>
      </div>
    </div>
  )
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
      <AlertCircle className="h-4 w-4 flex-shrink-0" />
      {text}
    </div>
  )
}
