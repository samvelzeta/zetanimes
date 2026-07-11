
-- Restore public read on video_cache and video_cache_blocks so mother-URL
-- lookups work in all contexts (anon key, edge, unauthenticated boot paths).
GRANT SELECT ON public.video_cache TO anon;
GRANT SELECT ON public.video_cache_blocks TO anon;

DROP POLICY IF EXISTS "Public can read video_cache" ON public.video_cache;
CREATE POLICY "Public can read video_cache"
  ON public.video_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can read video_cache_blocks" ON public.video_cache_blocks;
CREATE POLICY "Public can read video_cache_blocks"
  ON public.video_cache_blocks
  FOR SELECT
  TO anon, authenticated
  USING (true);
