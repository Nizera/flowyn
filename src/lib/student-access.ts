import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

export async function claimPendingStudentAccess(userId: string, email: string | undefined | null) {
  if (!email) return

  const admin = createAdminClient()

  const { data: pendingRows } = await admin
    .from('student_access')
    .select('id, order_id')
    .is('user_id', null)
    .ilike('access_email', email)
    .is('revoked_at', null)

  if (!pendingRows || pendingRows.length === 0) return

  const validRowIds: string[] = []

  for (const row of pendingRows) {
    if (!row.order_id) continue

    const { data: order } = await admin
      .from('orders')
      .select('id, status')
      .eq('id', row.order_id)
      .maybeSingle()

    if (order?.status === 'paid') {
      validRowIds.push(row.id)
    }
  }

  if (validRowIds.length === 0) return

  await admin
    .from('student_access')
    .update({
      user_id: userId,
      last_accessed_at: new Date().toISOString(),
    })
    .in('id', validRowIds)
}
