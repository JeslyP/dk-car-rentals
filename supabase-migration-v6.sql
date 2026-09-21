-- ============================================
-- D&J Car Rentals - Migration v6: vehicle photo storage
-- Creates the bucket the admin uploads vehicle photos into.
-- Run this ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================

-- Public read so the fleet page can show the pictures. Writes go through the
-- app's /api/admin/upload route using the service role key, so the public key
-- gets no insert, update or delete access here.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-photos',
  'vehicle-photos',
  true,
  5242880,  -- 5 MB; photos are shrunk in the browser before they are sent
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view vehicle photos" ON storage.objects;
CREATE POLICY "Public can view vehicle photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'vehicle-photos');
