import Link from 'next/link'
import { forgotPassword } from '@/app/auth/actions'
import { AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, Mail } from 'lucide-react'

export default async function ForgotPasswordPage(props: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const searchParams = await props.searchParams

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#f97316]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-8">
          <img src="/brand/logo-white-transparent.png" alt="Flowyn" className="h-20 w-auto" />
        </Link>

        {/* Card */}
        <div className="bg-[#111111] border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center mb-6">
            <Mail className="w-7 h-7 text-[#f97316]" />
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2">Recuperar senha</h1>
          <p className="text-sm text-white/50 mb-6">
            Digite seu e-mail e enviaremos um link para você criar uma nova senha.
          </p>

          {/* Banners */}
          {searchParams.success === 'email_sent' && (
            <div className="bg-[#f97316]/10 text-[#f97316] p-4 rounded-xl text-sm flex items-start gap-3 border border-[#f97316]/30 mb-6">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">E-mail enviado! 📬</p>
                <p className="text-[#f97316]/70 text-xs mt-0.5">
                  Verifique sua caixa de entrada e clique no link para redefinir sua senha. O link expira em 1 hora.
                </p>
              </div>
            </div>
          )}

          {searchParams.error && (
            <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2 border border-red-500/20 mb-6">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {searchParams.error}
            </div>
          )}

          {/* Form */}
          {searchParams.success !== 'email_sent' && (
            <form action={forgotPassword} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-white/80 mb-2">
                  Seu e-mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-white placeholder-white/30 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316] transition-all font-medium"
                  placeholder="voce@email.com"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-[#f97316] px-4 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:-translate-y-0.5 transition-all"
              >
                Enviar link de recuperação
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Back to login */}
          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
