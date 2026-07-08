import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { updateProfile, changePassword } from '@/app/auth/actions'
import { AlertCircle, CheckCircle2, Lock, Save, Shield, User } from 'lucide-react'

export default async function ProfilePage(props: {
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, document_number, phone, role')
    .eq('id', user.id)
    .single()

  const activeTab = searchParams.tab === 'security' ? 'security' : 'profile'

  return (
    <section className="overflow-hidden rounded-[10px] bg-white px-8 py-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">Minha conta</h2>
          <p className="mt-2 text-sm text-slate-400">Gerencie seus dados pessoais e seguranca.</p>
        </div>
      </div>

      {(searchParams.success || searchParams.error) && (
        <div className={`mt-8 flex items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium ring-1 ${searchParams.error ? 'bg-red-50 text-red-700 ring-red-100' : 'bg-emerald-50 text-emerald-700 ring-emerald-100'}`}>
          {searchParams.error ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />}
          <p>{searchParams.error || (searchParams.success === 'password_changed' ? 'Senha alterada com sucesso.' : 'Perfil atualizado com sucesso.')}</p>
        </div>
      )}

      <div className="mt-8 flex gap-2 overflow-x-auto border-b border-slate-200">
        <a href="/dashboard/settings/profile" className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === 'profile' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
          <User className="h-4 w-4" />
          Dados pessoais
        </a>
        <a href="/dashboard/settings/profile?tab=security" className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === 'security' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
          <Shield className="h-4 w-4" />
          Seguranca
        </a>
      </div>

      {activeTab === 'profile' && (
        <form action={updateProfile} className="mt-10 max-w-5xl">
          <div className="grid border-y border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Conta" description="Dados fixos da sua conta." />
            <div className="grid gap-5 py-6 md:pl-8 lg:grid-cols-2">
              <Field label="E-mail da conta">
                <div className="flex h-12 items-center rounded-xl bg-slate-50 px-4 text-sm font-medium text-slate-400">{user.email}</div>
              </Field>
              <Field label="Tipo de conta">
                <div className="flex h-12 items-center">
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600">
                    {profile?.role === 'producer' ? 'Produtor' : 'Usuario'}
                  </span>
                </div>
              </Field>
            </div>
          </div>

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Perfil" description="Informacoes pessoais e contato." />
            <div className="grid gap-5 py-6 md:pl-8 lg:grid-cols-2">
              <Field label="Nome completo" required>
                <input id="full_name" name="full_name" type="text" defaultValue={profile?.full_name ?? ''} required className={inputClass} placeholder="Joao da Silva" />
              </Field>
              <Field label="CPF / CNPJ">
                <input id="document_number" name="document_number" type="text" defaultValue={profile?.document_number ?? ''} className={inputClass} placeholder="000.000.000-00" />
              </Field>
              <Field label="Telefone / WhatsApp">
                <input id="phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} className={inputClass} placeholder="(11) 99999-9999" />
              </Field>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
              <Save className="h-4 w-4" />
              Salvar alteracoes
            </button>
          </div>
        </form>
      )}

      {activeTab === 'security' && (
        <form action={changePassword} className="mt-10 max-w-5xl">
          <div className="grid border-y border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Senha" description="Atualize sua senha de acesso." />
            <div className="grid gap-5 py-6 md:pl-8 lg:grid-cols-2">
              <Field label="Nova senha" required>
                <input id="password" name="password" type="password" required minLength={8} className={inputClass} placeholder="Minimo 8 caracteres" />
              </Field>
              <Field label="Confirmar nova senha" required>
                <input id="confirm_password" name="confirm_password" type="password" required minLength={8} className={inputClass} placeholder="Repita a nova senha" />
              </Field>
            </div>
          </div>

          <div className="grid border-b border-slate-200 md:grid-cols-[240px_1fr]">
            <RowTitle title="Recuperacao" description="Alternativa por e-mail." />
            <div className="py-6 md:pl-8">
              <a href="/forgot-password" className="text-sm font-semibold text-orange-600 transition hover:text-orange-800">
                Recuperar senha por e-mail
              </a>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-7 text-sm font-semibold text-white transition hover:from-orange-600 hover:to-amber-600">
              <Lock className="h-4 w-4" />
              Alterar senha
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

const inputClass = 'h-12 w-full rounded-xl border-0 bg-[#f4f4f6] px-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-orange-500/20'

function RowTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-6 md:pr-8">
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  )
}
