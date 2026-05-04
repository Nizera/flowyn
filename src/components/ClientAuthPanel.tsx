"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Rocket, Code2, ArrowRight } from 'lucide-react'
import { login, signup } from '@/app/auth/actions'

interface ClientAuthPanelProps {
  initialError?: string;
  initialType?: string;
  initialSuccess?: string;
}

export function ClientAuthPanel({ initialError, initialType, initialSuccess }: ClientAuthPanelProps) {
  const [isLogin, setIsLogin] = useState(initialType !== 'register')
  const [role, setRole] = useState<'affiliate' | 'producer'>(initialType === 'producer' ? 'producer' : 'affiliate')

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 md:p-8 relative overflow-hidden">
      {/* Background Noise & Glows */}
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
        style={{ backgroundImage: 'url("/noise.png")', backgroundRepeat: 'repeat' }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00e88a]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative w-full max-w-5xl md:h-[700px] min-h-[600px] bg-[#111111] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row z-10">
        
        {/* MOBILE: Toggle buttons (visible only on mobile) */}
        <div className="flex md:hidden w-full border-b border-white/10 p-2 gap-2 bg-[#0d0d0d]">
          <button 
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isLogin ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
          >
            Entrar
          </button>
          <button 
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isLogin ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'}`}
          >
            Criar Conta
          </button>
        </div>

        {/* --- SIGN IN FORM (Desktop Right, Mobile Stacked) --- */}
        <div className={`w-full md:w-1/2 h-full p-8 md:p-12 flex flex-col justify-center transition-all duration-700 ease-in-out md:absolute md:top-0 md:right-0 
          ${isLogin ? 'block md:z-20 md:translate-x-0 md:opacity-100' : 'hidden md:flex md:z-10 md:translate-x-[20%] md:opacity-0'}
        `}>
          <div className="w-full max-w-sm mx-auto">
            <Link href="/" className="flex items-center mb-8">
              <img src="/logo2.png" alt="Flowyn" className="h-20 w-auto" />
            </Link>
            <h2 className="text-3xl font-extrabold text-white mb-2">Acesse sua conta</h2>
            <p className="text-sm text-white/50 mb-8">Bem-vindo de volta! Sinta o fluxo do seu negócio.</p>
            
            <form action={login} className="space-y-6">
              {isLogin && initialSuccess === 'registered' && (
                <div className="bg-[#00e88a]/10 text-[#00e88a] p-4 rounded-xl text-sm flex items-start gap-3 border border-[#00e88a]/30">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm">Conta criada com sucesso! 🎉</p>
                    <p className="text-[#00e88a]/70 text-xs mt-0.5">Faça login para acessar sua plataforma.</p>
                  </div>
                </div>
              )}
              {isLogin && initialError && (
                <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {initialError}
                </div>
              )}
              <div>
                <label htmlFor="email_login" className="block text-sm font-semibold text-white/80 mb-2">E-mail</label>
                <input
                  id="email_login"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-white placeholder-white/30 focus:border-[#00e88a] focus:outline-none focus:ring-1 focus:ring-[#00e88a] transition-all font-medium"
                  placeholder="voce@email.com"
                />
              </div>
              <div>
                <label htmlFor="password_login" className="block text-sm font-semibold text-white/80 mb-2">Senha</label>
                <input
                  id="password_login"
                  name="password"
                  type="password"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-3 text-white placeholder-white/30 focus:border-[#00e88a] focus:outline-none focus:ring-1 focus:ring-[#00e88a] transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                  <input type="checkbox" className="rounded border-white/20 bg-[#0a0a0a] text-[#00e88a] focus:ring-[#00e88a] h-4 w-4" />
                  Lembrar de mim
                </label>
                <a href="#" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Esqueceu a senha?</a>
              </div>
              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-[#00e88a] px-4 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(0,232,138,0.3)] hover:shadow-[0_0_30px_rgba(0,232,138,0.5)] hover:-translate-y-0.5 transition-all"
              >
                Entrar na Plataforma
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* --- SIGN UP FORM (Desktop Left, Mobile Stacked) --- */}
        <div className={`w-full md:w-1/2 h-full p-8 md:p-12 flex flex-col justify-center transition-all duration-700 ease-in-out md:absolute md:top-0 md:left-0 
          ${!isLogin ? 'block md:z-20 md:translate-x-0 md:opacity-100' : 'hidden md:flex md:z-10 md:-translate-x-[20%] md:opacity-0'}
        `}>
          <div className="w-full max-w-sm mx-auto">
            <Link href="/" className="flex items-center mb-6">
              <img src="/logo2.png" alt="Flowyn" className="h-20 w-auto" />
            </Link>
            <h2 className="text-3xl font-extrabold text-white mb-2">Crie sua conta</h2>
            <p className="text-sm text-white/50 mb-6">Comece sua jornada de escala infinita.</p>

            <form action={signup} className="space-y-4">
              {!isLogin && initialError && (
                <div className="bg-red-500/10 text-red-400 p-3 rounded-xl text-sm flex items-center gap-2 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {initialError}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Seu perfil</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`relative flex cursor-pointer rounded-xl border p-3 transition-colors ${role === 'affiliate' ? 'border-[#00e88a] bg-[#00e88a]/5' : 'border-white/10 hover:border-white/20 bg-[#0a0a0a]'}`}>
                    <input type="radio" name="role" value="affiliate" className="sr-only" checked={role === 'affiliate'} onChange={() => setRole('affiliate')} />
                    <span className="flex flex-col">
                      <Rocket className={`h-5 w-5 mb-1 ${role === 'affiliate' ? 'text-[#00e88a]' : 'text-white/40'}`} />
                      <span className={`block text-sm font-bold ${role === 'affiliate' ? 'text-[#00e88a]' : 'text-white/80'}`}>Afiliado</span>
                    </span>
                  </label>
                  <label className={`relative flex cursor-pointer rounded-xl border p-3 transition-colors ${role === 'producer' ? 'border-[#00e88a] bg-[#00e88a]/5' : 'border-white/10 hover:border-white/20 bg-[#0a0a0a]'}`}>
                    <input type="radio" name="role" value="producer" className="sr-only" checked={role === 'producer'} onChange={() => setRole('producer')} />
                    <span className="flex flex-col">
                      <Code2 className={`h-5 w-5 mb-1 ${role === 'producer' ? 'text-[#00e88a]' : 'text-white/40'}`} />
                      <span className={`block text-sm font-bold ${role === 'producer' ? 'text-[#00e88a]' : 'text-white/80'}`}>Produtor</span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label htmlFor="full_name" className="block text-sm font-semibold text-white/80 mb-1">Nome Completo</label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-2.5 text-white placeholder-white/30 focus:border-[#00e88a] focus:outline-none focus:ring-1 focus:ring-[#00e88a] transition-all font-medium"
                  placeholder="João da Silva"
                />
              </div>

              <div>
                <label htmlFor="email_register" className="block text-sm font-semibold text-white/80 mb-1">E-mail</label>
                <input
                  id="email_register"
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-2.5 text-white placeholder-white/30 focus:border-[#00e88a] focus:outline-none focus:ring-1 focus:ring-[#00e88a] transition-all font-medium"
                  placeholder="voce@email.com"
                />
              </div>

              <div>
                <label htmlFor="password_register" className="block text-sm font-semibold text-white/80 mb-1">Senha</label>
                <input
                  id="password_register"
                  name="password"
                  type="password"
                  required
                  className="block w-full rounded-xl border border-white/10 bg-[#0a0a0a] px-4 py-2.5 text-white placeholder-white/30 focus:border-[#00e88a] focus:outline-none focus:ring-1 focus:ring-[#00e88a] transition-all font-medium"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black shadow-lg hover:bg-gray-200 transition-all mt-6"
              >
                Criar conta grátis
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* --- DESKTOP ONLY: Overlay Container (Sliding Panel) --- */}
        <div className={`hidden md:block absolute top-0 left-0 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-50 ${isLogin ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className={`bg-[#050505] relative h-full w-[200%] transition-transform duration-700 ease-in-out border-l border-r border-white/5 ${isLogin ? 'translate-x-0' : '-translate-x-1/2'}`}>
            
            {/* Visual background details in the sliding panel */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
               <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-[#00e88a]/10 blur-[80px]"></div>
               <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-[#00e88a]/5 blur-[80px]"></div>
               <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'url("/noise.png")', backgroundRepeat: 'repeat' }}></div>
            </div>

            {/* Inner Content that counter-animates to stay centered visually */}
            <div className="absolute inset-0 w-full h-full flex">
              
              {/* Left Side (Shows when Register is open, Overlay is on Right) */}
              <div className="w-1/2 h-full flex flex-col justify-center items-center text-center p-12 z-10">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isLogin ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: isLogin ? 0.3 : 0 }}
                    className="w-full"
                  >
                    <h2 className="text-4xl font-extrabold text-white mb-6">Ainda não tem conta?</h2>
                    <p className="text-lg text-white/50 mb-8 max-w-sm mx-auto">
                      Junte-se à Flowyn e escale suas vendas B2B e infoprodutos com checkout de alta conversão.
                    </p>
                    <button 
                      onClick={() => setIsLogin(false)}
                      className="border border-white/20 text-white font-bold rounded-xl px-12 py-3 hover:bg-white/10 transition-all"
                    >
                      Cadastre-se grátis
                    </button>
                  </motion.div>
              </div>

              {/* Right Side (Shows when Login is open, Overlay is on Left) */}
              <div className="w-1/2 h-full flex flex-col justify-center items-center text-center p-12 z-10">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: !isLogin ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: !isLogin ? 0.3 : 0 }}
                    className="w-full"
                  >
                    <h2 className="text-4xl font-extrabold text-white mb-6">Já é membro?</h2>
                    <p className="text-lg text-white/50 mb-8 max-w-sm mx-auto">
                      Acesse seu painel para acompanhar suas vendas, assinaturas e split de pagamentos em tempo real.
                    </p>
                    <button 
                      onClick={() => setIsLogin(true)}
                      className="border border-white/20 text-white font-bold rounded-xl px-12 py-3 hover:bg-white/10 transition-all"
                    >
                      Entrar na conta
                    </button>
                  </motion.div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

