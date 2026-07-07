-- ============================================================
-- Migration v24: Revocable student access for refund/chargeback
-- ============================================================

ALTER TABLE public.student_access
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_student_access_revoked
  ON public.student_access(product_id, user_id)
  WHERE revoked_at IS NULL;
