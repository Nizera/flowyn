-- Complete and harden Flowyn Journey mentorship operations.

ALTER TABLE public.mentorship_programs
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS booking_min_notice_hours INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS cancellation_notice_hours INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS max_reschedules INTEGER NOT NULL DEFAULT 2;

ALTER TABLE public.mentorship_programs
  DROP CONSTRAINT IF EXISTS mentorship_program_booking_rules_check,
  ADD CONSTRAINT mentorship_program_booking_rules_check CHECK (
    session_count BETWEEN 1 AND 100
    AND session_duration_minutes BETWEEN 15 AND 480
    AND booking_min_notice_hours BETWEEN 0 AND 720
    AND cancellation_notice_hours BETWEEN 0 AND 720
    AND max_reschedules BETWEEN 0 AND 20
  );

ALTER TABLE public.mentorship_sessions
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

ALTER TABLE public.mentorship_sessions
  DROP CONSTRAINT IF EXISTS mentorship_sessions_schedule_check,
  ADD CONSTRAINT mentorship_sessions_schedule_check CHECK (ends_at IS NULL OR scheduled_at IS NULL OR ends_at > scheduled_at),
  DROP CONSTRAINT IF EXISTS mentorship_sessions_reschedule_count_check,
  ADD CONSTRAINT mentorship_sessions_reschedule_count_check CHECK (reschedule_count >= 0);

CREATE INDEX IF NOT EXISTS idx_mentorship_sessions_upcoming
  ON public.mentorship_sessions(student_id, scheduled_at) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS public.mentorship_program_private (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  default_meeting_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mentorship_slot_private (
  slot_id UUID PRIMARY KEY REFERENCES public.mentorship_availability_slots(id) ON DELETE CASCADE,
  meeting_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.mentorship_private_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentorship_private_notes_student
  ON public.mentorship_private_notes(product_id, student_id, created_at DESC);

INSERT INTO public.mentorship_program_private (product_id, default_meeting_url)
SELECT product_id, meeting_url FROM public.mentorship_programs WHERE meeting_url IS NOT NULL
ON CONFLICT (product_id) DO UPDATE SET default_meeting_url = EXCLUDED.default_meeting_url, updated_at = NOW();

INSERT INTO public.mentorship_slot_private (slot_id, meeting_url)
SELECT id, meeting_url FROM public.mentorship_availability_slots WHERE meeting_url IS NOT NULL
ON CONFLICT (slot_id) DO UPDATE SET meeting_url = EXCLUDED.meeting_url, updated_at = NOW();

UPDATE public.mentorship_programs SET meeting_url = NULL WHERE meeting_url IS NOT NULL;
UPDATE public.mentorship_availability_slots SET meeting_url = NULL WHERE meeting_url IS NOT NULL;

ALTER TABLE public.mentorship_program_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_slot_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentorship_private_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage private mentorship program settings" ON public.mentorship_program_private;
CREATE POLICY "Owners manage private mentorship program settings" ON public.mentorship_program_private FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = mentorship_program_private.product_id AND p.owner_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.products p WHERE p.id = mentorship_program_private.product_id AND p.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Owners manage private mentorship slot settings" ON public.mentorship_slot_private;
CREATE POLICY "Owners manage private mentorship slot settings" ON public.mentorship_slot_private FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.mentorship_availability_slots s JOIN public.products p ON p.id = s.product_id WHERE s.id = mentorship_slot_private.slot_id AND p.owner_id = (SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.mentorship_availability_slots s JOIN public.products p ON p.id = s.product_id WHERE s.id = mentorship_slot_private.slot_id AND p.owner_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Owners manage mentorship private notes" ON public.mentorship_private_notes;
CREATE POLICY "Owners manage mentorship private notes" ON public.mentorship_private_notes FOR ALL TO authenticated
USING (author_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = mentorship_private_notes.product_id AND p.owner_id = (SELECT auth.uid())))
WITH CHECK (author_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = mentorship_private_notes.product_id AND p.owner_id = (SELECT auth.uid())));

REVOKE ALL ON public.mentorship_program_private, public.mentorship_slot_private, public.mentorship_private_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentorship_program_private, public.mentorship_slot_private, public.mentorship_private_notes TO authenticated;
GRANT ALL ON public.mentorship_program_private, public.mentorship_slot_private, public.mentorship_private_notes TO service_role;

CREATE OR REPLACE FUNCTION public.guard_mentorship_task_student_update() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.student_id = (SELECT auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = OLD.product_id AND p.owner_id = (SELECT auth.uid()))
    AND (NEW.id, NEW.product_id, NEW.session_id, NEW.student_id, NEW.title, NEW.description, NEW.due_at, NEW.created_at)
      IS DISTINCT FROM (OLD.id, OLD.product_id, OLD.session_id, OLD.student_id, OLD.title, OLD.description, OLD.due_at, OLD.created_at)
  THEN RAISE EXCEPTION 'Students may only update task completion'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_mentorship_task_student_update_trigger ON public.mentorship_tasks;
CREATE TRIGGER guard_mentorship_task_student_update_trigger BEFORE UPDATE ON public.mentorship_tasks
FOR EACH ROW EXECUTE FUNCTION public.guard_mentorship_task_student_update();

CREATE OR REPLACE FUNCTION public.guard_mentorship_intake_student_update() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.student_id = (SELECT auth.uid())
    AND (NEW.id, NEW.product_id, NEW.student_id, NEW.created_at) IS DISTINCT FROM (OLD.id, OLD.product_id, OLD.student_id, OLD.created_at)
  THEN RAISE EXCEPTION 'Immutable intake fields cannot be changed'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS guard_mentorship_intake_student_update_trigger ON public.mentorship_intake_responses;
CREATE TRIGGER guard_mentorship_intake_student_update_trigger BEFORE UPDATE ON public.mentorship_intake_responses
FOR EACH ROW EXECUTE FUNCTION public.guard_mentorship_intake_student_update();

CREATE OR REPLACE FUNCTION public.prevent_overlapping_mentorship_slots() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.mentorship_availability_slots existing
    WHERE existing.product_id = NEW.product_id AND existing.id <> NEW.id
      AND tstzrange(existing.starts_at, existing.ends_at, '[)') && tstzrange(NEW.starts_at, NEW.ends_at, '[)')
  ) THEN RAISE EXCEPTION 'Mentorship availability slots cannot overlap'; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS prevent_overlapping_mentorship_slots_trigger ON public.mentorship_availability_slots;
CREATE TRIGGER prevent_overlapping_mentorship_slots_trigger
BEFORE INSERT OR UPDATE OF starts_at, ends_at, product_id ON public.mentorship_availability_slots
FOR EACH ROW EXECUTE FUNCTION public.prevent_overlapping_mentorship_slots();

REVOKE EXECUTE ON FUNCTION public.guard_mentorship_task_student_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_mentorship_intake_student_update() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.prevent_overlapping_mentorship_slots() FROM anon, authenticated, public;
