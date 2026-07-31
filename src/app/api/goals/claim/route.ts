import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { verifyOrigin } from '@/lib/csrf'

// POST: Resgatar prêmio de uma conquista
export async function POST(req: NextRequest) {
  const csrfError = verifyOrigin(req)
  if (csrfError) return csrfError

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawBody = await req.text()
  if (rawBody.length > 4096) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 })
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(rawBody) } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 })
  }

  const { badge_type, address } = body as {
    badge_type?: string
    address?: {
      full_name: string
      street: string
      number: string
      complement?: string
      neighborhood: string
      city: string
      state: string
      zip_code: string
      phone: string
    }
  }

  if (!badge_type || typeof badge_type !== 'string') {
    return NextResponse.json({ error: 'badge_type obrigatório' }, { status: 400 })
  }

  // Buscar configuração do badge
  const { data: badgeConfig, error: configError } = await supabase
    .from('badge_rewards')
    .select('*')
    .eq('badge_type', badge_type)
    .single()

  if (configError || !badgeConfig) {
    return NextResponse.json({ error: 'Badge não encontrado' }, { status: 404 })
  }

  // Verificar se o badge foi conquistado
  const { data: achievement, error: achievementError } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id)
    .eq('badge_type', badge_type)
    .single()

  if (achievementError || !achievement) {
    return NextResponse.json({ error: 'Badge não conquistado' }, { status: 400 })
  }

  if (achievement.reward_claimed) {
    return NextResponse.json({ error: 'Prêmio já resgatado' }, { status: 400 })
  }

  // Se requer endereço, validar
  if (badgeConfig.requires_address) {
    if (!address || !address.full_name || !address.street || !address.number || !address.neighborhood || !address.city || !address.state || !address.zip_code || !address.phone) {
      return NextResponse.json({ error: 'Endereço completo obrigatório para este badge' }, { status: 400 })
    }
  }

  // Atualizar conquista com endereço e marcar como resgatado
  const updateData: Record<string, unknown> = {
    reward_claimed: true,
  }

  if (badgeConfig.requires_address && address) {
    updateData.reward_address = address
  }

  const { error: updateError } = await supabase
    .from('user_achievements')
    .update(updateData)
    .eq('id', achievement.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Se for badge iniciante (PDF), marcar como enviado
  if (badge_type === 'iniciante') {
    await supabase
      .from('user_achievements')
      .update({ pdf_sent: true })
      .eq('id', achievement.id)
  }

  return NextResponse.json({
    success: true,
    message: 'Prêmio resgatado com sucesso!',
    reward_name: badgeConfig.physical_reward_name || 'Placa PDF',
  })
}
