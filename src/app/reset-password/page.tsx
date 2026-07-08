import Link from 'next/link'
import { resetPassword } from '@/app/auth/actions'
import { isSafeRedirectPath } from '@/lib/validation'
import { AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, Lock } from 'lucide-react'

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ error?: string; success?: string; code?: string; next?: string }>
}) {
  const searchParams = await props.searchParams

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#f97316]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-8">
          <img src="/brand/logo-dark.png" alt="Flowyn" className="h-20 w-auto" />
        </Link>

        {/* Card */}
        <div className="bg-[#111111] border border-white/10 rounded-3xl p-8 shadow-2xl">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/20 flex items-center justify-center mb-6">
            <Lock className="w-7 h-7 text-[#f97316]" />
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-2">Nova senha</h1>
          <p className="text-sm text-white/50 mb-6">
            Escolha uma senha forte com pelo menos 8 caracteres, incluindo maiuscula, minuscula e numero.
          </p>

          {/* Banners */}
          {searchParams.success === 'password_reset' && (
            <div className="bg-[#f97316]/10 text-[#f97316] p-4 rounded-xl text-sm flex items-start gap-3 border border-[#f97316]/30 mb-6">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Senha redefinida com sucesso! 🔒</p>
                <p className="text-[#f97316]/70 text-xs mt-0.5">
                  Você já pode fazer login com sua nova senha.
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
          {searchParams.success !== 'password_reset' && (
            <form action={resetPassword} className="space-y-5">
              <input type="hidden" name="next" value={searchParams.next || ''} />
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-white/80 mb-2">
                  Nova senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-white placeholder-white/30 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316] transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirm_password" className="block text-sm font-semibold text-white/80 mb-2">
                  Confirmar nova senha
                </label>
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  minLength={8}
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-white placeholder-white/30 focus:border-[#f97316] focus:outline-none focus:ring-1 focus:ring-[#f97316] transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-[#f97316] px-4 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.5)] hover:-translate-y-0.5 transition-all"
              >
                Redefinir senha
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Links */}
          <div className="mt-6 text-center">
            {searchParams.success === 'password_reset' ? (
              <Link
                href={isSafeRedirectPath(searchParams.next) ? searchParams.next! : '/login'}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#f97316] hover:text-[#f97316]/80 transition-colors"
              >
                Ir para o login
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/forgot-password"
                className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Solicitar novo link
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
