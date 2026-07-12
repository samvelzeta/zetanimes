
-- latino_episodes: remove anon/public reads, keep authenticated
DROP POLICY IF EXISTS "Anyone can read latino episodes" ON public.latino_episodes;
DROP POLICY IF EXISTS "Public can read latino_episodes" ON public.latino_episodes;
REVOKE SELECT ON public.latino_episodes FROM anon;

-- video_cache: remove anon reads
DROP POLICY IF EXISTS "Public can read video_cache" ON public.video_cache;
REVOKE SELECT ON public.video_cache FROM anon;

-- video_cache_blocks: remove anon reads
DROP POLICY IF EXISTS "Public can read video_cache_blocks" ON public.video_cache_blocks;
REVOKE SELECT ON public.video_cache_blocks FROM anon;

-- user_achievements: scope to owner
DROP POLICY IF EXISTS "user_achievements public read" ON public.user_achievements;
CREATE POLICY "user_achievements self read"
  ON public.user_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- user_cosmetics: scope to owner (leaderboard uses SECURITY DEFINER get_leaderboard)
DROP POLICY IF EXISTS "cosmetics public read" ON public.user_cosmetics;
CREATE POLICY "cosmetics self read"
  ON public.user_cosmetics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- user_xp: scope to owner (leaderboard uses SECURITY DEFINER get_leaderboard)
DROP POLICY IF EXISTS "user_xp public read" ON public.user_xp;
CREATE POLICY "user_xp self read"
  ON public.user_xp FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
