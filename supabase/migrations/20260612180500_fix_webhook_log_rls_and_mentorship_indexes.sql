-- Remove public access to webhook logs and cover mentorship foreign keys.

DROP POLICY IF EXISTS "Only service role can read whatsapp webhook logs" ON public.whatsapp_webhook_logs;
DROP POLICY IF EXISTS "Only service role can insert whatsapp webhook logs" ON public.whatsapp_webhook_logs;
REVOKE ALL ON public.whatsapp_webhook_logs FROM anon, authenticated, public;
GRANT ALL ON public.whatsapp_webhook_logs TO service_role;

CREATE INDEX IF NOT EXISTS idx_mentorship_slots_booked_by
  ON public.mentorship_availability_slots(booked_by) WHERE booked_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentorship_slots_booked_session
  ON public.mentorship_availability_slots(booked_session_id) WHERE booked_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentorship_intake_student
  ON public.mentorship_intake_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_private_notes_author
  ON public.mentorship_private_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_mentorship_tasks_session
  ON public.mentorship_tasks(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mentorship_tasks_student
  ON public.mentorship_tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_user
  ON public.notification_events(user_id) WHERE user_id IS NOT NULL;
