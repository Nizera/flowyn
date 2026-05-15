-- Add order_bump_image_url column to products table
ALTER TABLE public.products
ADD COLUMN order_bump_image_url TEXT;
