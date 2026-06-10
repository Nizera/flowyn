-- ============================================================
-- Migration v22: Allow video MIME types in product-files bucket
-- ============================================================

-- Update product-files bucket to accept video files for course lessons
UPDATE storage.buckets
SET
  file_size_limit = 524288000, -- 500MB (up from 100MB)
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/zip',
    'application/epub+zip',
    'application/x-zip-compressed',
    'application/octet-stream',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
WHERE id = 'product-files';

