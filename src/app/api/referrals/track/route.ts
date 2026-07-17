import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, referral_code, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado.' }, { status: 404 })
  if (profile.role !== 'producer' && profile.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas produtores podem gerar código de indicação.' }, { status: 403 })
  }

  if (profile.referral_code) {
    return NextResponse.json({ code: profile.referral_code })
  }

  const { data, error } = await supabase.rpc('generate_referral_code', { profile_uuid: user.id })
  if (error) {
    console.error('[Referral] generate_referral_code error:', error)
    return NextResponse.json({ error: 'Erro ao gerar código.' }, { status: 500 })
  }

  const code = data as string

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ referral_code: code })
    .eq('id', user.id)
    .is('referral_code', null)

  if (updateError) {
    console.error('[Referral] update referral_code error:', updateError)
    return NextResponse.json({ error: 'Erro ao salvar código.' }, { status: 500 })
  }

  return NextResponse.json({ code })
}
