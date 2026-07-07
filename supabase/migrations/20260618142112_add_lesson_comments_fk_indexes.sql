-- Cover lesson_comments foreign keys to reduce lock time and improve joins at scale.
CREATE INDEX IF NOT EXISTS idx_lesson_comments_parent_id
  ON public.lesson_comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_product_id
  ON public.lesson_comments(product_id);

CREATE INDEX IF NOT EXISTS idx_lesson_comments_user_id
  ON public.lesson_comments(user_id);

-- Tighten table privileges. RLS remains the primary row-level guard, but
-- public roles should not hold unused write or system-level privileges.
REVOKE ALL ON public.checkout_customizations FROM anon;
REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.checkout_customizations FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.checkout_customizations TO authenticated;

REVOKE ALL ON public.product_order_bumps FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.product_order_bumps FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_order_bumps TO authenticated;

REVOKE ALL ON public.course_certificates FROM anon;
REVOKE INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.course_certificates FROM authenticated;
GRANT SELECT ON public.course_certificates TO authenticated;

REVOKE ALL ON public.lesson_comments FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.lesson_comments FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_comments TO authenticated;

REVOKE ALL ON public.lesson_progress FROM anon;
REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.lesson_progress FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lesson_progress TO authenticated;

REVOKE ALL ON public.mentorship_availability_slots FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_availability_slots FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_availability_slots TO authenticated;

REVOKE ALL ON public.mentorship_intake_responses FROM anon;
REVOKE DELETE, REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_intake_responses FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.mentorship_intake_responses TO authenticated;

REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_private_notes FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_private_notes TO authenticated;

REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_program_private FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_program_private TO authenticated;

REVOKE ALL ON public.mentorship_programs FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_programs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_programs TO authenticated;

REVOKE ALL ON public.mentorship_sessions FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_sessions FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_sessions TO authenticated;

REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_slot_private FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_slot_private TO authenticated;

REVOKE ALL ON public.mentorship_tasks FROM anon;
REVOKE REFERENCES, TRIGGER, TRUNCATE ON public.mentorship_tasks FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_tasks TO authenticated;

REVOKE ALL ON public.notification_events FROM anon, authenticated;
