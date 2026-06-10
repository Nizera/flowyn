-- ============================================================
-- Migration v23: Fix RLS on course_lessons — add WITH CHECK for INSERT
-- ============================================================

-- Drop the existing FOR ALL policy (USING only, no WITH CHECK — blocks INSERT)
DROP POLICY IF EXISTS "Product owners can manage lessons" ON public.course_lessons;

-- Re-create with explicit USING + WITH CHECK
CREATE POLICY "Product owners can manage lessons"
ON public.course_lessons
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.owner_id = auth.uid())
);
