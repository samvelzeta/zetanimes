-- Restore public read access for official playback link tables.
-- These rows are not private per-user cache; they are catalog playback records.
GRANT SELECT ON public.video_cache TO anon, authenticated;
GRANT SELECT ON public.video_cache_blocks TO anon, authenticated;
GRANT SELECT ON public.latino_episodes TO anon, authenticated;
GRANT ALL ON public.video_cache TO service_role;
GRANT ALL ON public.video_cache_blocks TO service_role;
GRANT ALL ON public.latino_episodes TO service_role;

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

DROP POLICY IF EXISTS "Public can read latino_episodes" ON public.latino_episodes;
CREATE POLICY "Public can read latino_episodes"
ON public.latino_episodes
FOR SELECT
TO anon, authenticated
USING (true);