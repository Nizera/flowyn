import 'server-only'
import { createAdminClient } from '@/utils/supabase/admin'

export async function claimPendingStudentAccess(userId: string, email: string | undefined | null) {
  if (!email) return

  const admin = createAdminClient()
  await admin
    .from('student_access')
    .update({
      user_id: userId,
      last_accessed_at: new Date().toISOString(),
    })
    .is('user_id', null)
    .ilike('access_email', email)
    .is('revoked_at', null)
}
