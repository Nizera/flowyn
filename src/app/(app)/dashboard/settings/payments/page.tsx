'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Banknote,
  ShieldCheck,
  ArrowRight,
  Wallet
} from 'lucide-react'
import { Suspense } from 'react'

interface AsaasStatus {
  connected: boolean
  wallet_id: string | null
  onboarding_status: string
}

function PaymentsContent() {
  const [status, setStatus] = useState<AsaasStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    companyType: 'INDIVIDUAL',
    birthDate: '',
    incomeValue: '',
    phone: '',
    address: '',
    addressNumber: '',
    complement: '',
    province: '',
    postalCode: ''
  })

  useEffect(() => {
    checkStatus()
  }, [])

  async function checkStatus() {
    setLoading(true)
    try {
      const res = await fetch('/api/asaas/status')
      const data = await res.json()
      setStatus(data)
      
      // Pre-fill form if data exists in profile
      if (data.profile) {
        setFormData({
          name: data.profile.full_name || '',
          email: data.email || '',
          cpfCnpj: data.profile.document_number || '',
          companyType: data.profile.company_type || 'INDIVIDUAL',
          birthDate: data.profile.birth_date || '',
          incomeValue: data.profile.income_value?.toString() || '',
          phone: data.profile.phone || '',
          address: data.profile.address || '',
          addressNumber: data.profile.address_number || '',
          complement: data.profile.complement || '',
          province: data.profile.province || '',
          postalCode: data.profile.postal_code || ''
        })
      }

    } catch (err) {
      setError('Erro ao verificar status da conta')
    }
    setLoading(false)
  }


  async function handleCreateAccount() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/asaas/create-account', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta Asaas')
      } else {
        setStatus(prev => prev ? { ...prev, connected: true, wallet_id: data.wallet_id } : null)
      }
    } catch (err) {
      setError('Erro de conexão')
    } finally {
      setCreating(false)
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00e88a]" />
      </div>
    )
  }

  const isActive = status?.connected && status?.wallet_id

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <CreditCard className="w-7 h-7 text-[#00e88a]" />
          Configurações de Pagamento
        </h1>
        <p className="text-white/50 mt-1">
          Configure sua conta Asaas para receber pagamentos e comissões via Split.
        </p>
      </div>

      {/* Connection Status Card */}
      <div className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        {/* Status Header */}
        <div className={`px-6 py-5 border-b ${isActive ? 'bg-[#00e88a]/5 border-white/5' : 'bg-[#0a0a0a] border-white/5'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-[#00e88a]/10' : 'bg-white/5 border border-white/10'}`}>
                {isActive ? (
                  <CheckCircle2 className="w-5 h-5 text-[#00e88a]" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-white/40" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white">
                  {isActive ? 'Conta Asaas Configurada' : 'Conta não configurada'}
                </h3>
                <p className="text-sm text-white/50">
                  {isActive 
                    ? 'Seu Wallet ID está configurado para splits' 
                    : 'Insira seu Wallet ID do Asaas para começar'}
                </p>
              </div>
            </div>
            <button
              onClick={checkStatus}
              className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-all"
              title="Atualizar status"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Details */}
        <div className="p-6">
          <div className="space-y-6">
            {!isActive ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      CPF ou CNPJ
                    </label>
                    <input 
                      type="text" 
                      value={formData.cpfCnpj}
                      onChange={(e) => setFormData({...formData, cpfCnpj: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="000.000.000-00" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Tipo de Conta
                    </label>
                    <select 
                      value={formData.companyType}
                      onChange={(e) => setFormData({...formData, companyType: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm"
                    >
                      <option value="INDIVIDUAL">Pessoa Física</option>
                      <option value="MEI">MEI</option>
                      <option value="LIMITED">Empresa (LTDA/SA)</option>
                    </select>
                  </div>
                  {formData.companyType === 'INDIVIDUAL' && (
                    <div>
                      <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                        Data de Nascimento
                      </label>
                      <input 
                        type="date" 
                        value={formData.birthDate}
                        onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                        className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Renda ou Faturamento Mensal
                    </label>
                    <input 
                      type="number" 
                      value={formData.incomeValue}
                      onChange={(e) => setFormData({...formData, incomeValue: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="Ex: 5000" 
                    />
                  </div>


                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Telefone
                    </label>
                    <input 
                      type="text" 
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="(00) 00000-0000" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      CEP
                    </label>
                    <input 
                      type="text" 
                      value={formData.postalCode}
                      onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="00000-000" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Endereço
                    </label>
                    <input 
                      type="text" 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="Nome da rua" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Número
                    </label>
                    <input 
                      type="text" 
                      value={formData.addressNumber}
                      onChange={(e) => setFormData({...formData, addressNumber: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="123" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Bairro
                    </label>
                    <input 
                      type="text" 
                      value={formData.province}
                      onChange={(e) => setFormData({...formData, province: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="Centro" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 mb-1 uppercase tracking-wider">
                      Complemento (Opcional)
                    </label>
                    <input 
                      type="text" 
                      value={formData.complement}
                      onChange={(e) => setFormData({...formData, complement: e.target.value})}
                      className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-[#00e88a]/30 outline-none text-sm" 
                      placeholder="Apt 101" 
                    />
                  </div>
                </div>

                <button 
                  onClick={handleCreateAccount}
                  disabled={creating || !formData.cpfCnpj || !formData.address}
                  className="w-full bg-[#00e88a] hover:bg-[#00e88a]/90 text-black font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,232,138,0.3)] mt-4"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Criando sua carteira...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Ativar Minha Carteira Flowyn
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-white/30 uppercase tracking-widest mt-2">
                  Ao ativar, você concorda com os termos da Asaas e Flowyn
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-[#00e88a]" />
                  Seu Wallet ID Ativo
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly
                    value={status?.wallet_id || ''}
                    className="flex-1 bg-[#0a0a0a] border border-[#00e88a]/20 rounded-xl py-3 px-4 text-[#00e88a] outline-none text-sm font-mono" 
                  />
                  <div className="bg-[#00e88a]/10 border border-[#00e88a]/20 px-4 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[#00e88a]" />
                  </div>
                </div>
                <p className="text-xs text-white/40 mt-3">
                  Sua conta está pronta para receber splits automáticos.
                </p>
              </div>
            )}


            {/* Benefits */}
            <div className="space-y-4 border-t border-white/5 pt-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#00e88a]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00e88a]/20">
                  <Banknote className="w-4 h-4 text-[#00e88a]" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">Split Automático</h4>
                  <p className="text-sm text-white/50">Receba sua parte instantaneamente em cada venda, sem esperas.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#00e88a]/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#00e88a]/20">
                  <ShieldCheck className="w-4 h-4 text-[#00e88a]" />
                </div>
                <div>
                  <h4 className="font-medium text-white text-sm">Segurança Asaas</h4>
                  <p className="text-sm text-white/50">Seus pagamentos são processados pela maior conta digital do Brasil.</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-4">
              <p className="text-sm text-white/60">
                <ShieldCheck className="w-4 h-4 inline mr-1 text-[#00e88a]" />
                Precisa de ajuda para encontrar seu Wallet ID? 
                <a href="https://ajuda.asaas.com" target="_blank" className="text-[#00e88a] hover:underline ml-1 inline-flex items-center gap-1">
                  Ver tutorial <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentsSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#00e88a]" />
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  )
}

