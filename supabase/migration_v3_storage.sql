-- ============================================================
-- Migration v3: Supabase Storage Buckets + Product Deliverable
-- ============================================================

-- 1. Bucket público para imagens de produto (capa, logo, banner)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Bucket privado para entregáveis (PDFs, ZIPs, EPUBs)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-files',
  'product-files',
  false,
  104857600, -- 100MB
  ARRAY['application/pdf','application/zip','application/epub+zip',
        'application/x-zip-compressed','application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS Policies: product-images (público)
CREATE POLICY "product_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_images_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'product-images');

-- 4. RLS Policies: product-files (privado)
CREATE POLICY "product_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_files_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "product_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Apenas service_role lê arquivos privados (para gerar signed URLs no webhook)
CREATE POLICY "product_files_service_role_select" ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'product-files');

-- 5. Nova coluna na tabela products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deliverable_file_path TEXT DEFAULT NULL;

-- Comentário
COMMENT ON COLUMN public.products.deliverable_file_path IS
  'Path do arquivo entregável no bucket product-files (ex: {user_id}/ebook.pdf). Usado para gerar signed URL após pagamento confirmado.';
