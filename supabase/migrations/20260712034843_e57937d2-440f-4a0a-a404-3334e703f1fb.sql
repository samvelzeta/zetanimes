
-- Restore public read on latino_episodes
GRANT SELECT ON public.latino_episodes TO anon;
CREATE POLICY "Public can read latino_episodes"
  ON public.latino_episodes FOR SELECT
  TO anon, authenticated
  USING (true);

-- Restore public read on video_cache
GRANT SELECT ON public.video_cache TO anon;
CREATE POLICY "Public can read video_cache"
  ON public.video_cache FOR SELECT
  TO anon, authenticated
  USING (true);

-- Restore public read on video_cache_blocks
GRANT SELECT ON public.video_cache_blocks TO anon;
CREATE POLICY "Public can read video_cache_blocks"
  ON public.video_cache_blocks FOR SELECT
  TO anon, authenticated
  USING (true);
