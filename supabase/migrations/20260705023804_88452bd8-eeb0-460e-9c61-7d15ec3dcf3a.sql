
-- Restrict public SELECT on stream URL tables to authenticated users
DROP POLICY IF EXISTS "Latino episodes are viewable by everyone" ON public.latino_episodes;
DROP POLICY IF EXISTS "Public read latino_episodes" ON public.latino_episodes;
DROP POLICY IF EXISTS "Anyone can view latino episodes" ON public.latino_episodes;
DROP POLICY IF EXISTS "latino_episodes_select" ON public.latino_episodes;
DROP POLICY IF EXISTS "select_latino_episodes" ON public.latino_episodes;

CREATE POLICY "Authenticated users can read latino_episodes"
ON public.latino_episodes
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.latino_episodes FROM anon;

DROP POLICY IF EXISTS "Video cache is viewable by everyone" ON public.video_cache;
DROP POLICY IF EXISTS "Public read video_cache" ON public.video_cache;
DROP POLICY IF EXISTS "Anyone can view video cache" ON public.video_cache;
DROP POLICY IF EXISTS "video_cache_select" ON public.video_cache;
DROP POLICY IF EXISTS "select_video_cache" ON public.video_cache;

CREATE POLICY "Authenticated users can read video_cache"
ON public.video_cache
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.video_cache FROM anon;

DROP POLICY IF EXISTS "Video cache blocks are viewable by everyone" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "Public read video_cache_blocks" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "Anyone can view video cache blocks" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "video_cache_blocks_select" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "select_video_cache_blocks" ON public.video_cache_blocks;

CREATE POLICY "Authenticated users can read video_cache_blocks"
ON public.video_cache_blocks
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.video_cache_blocks FROM anon;
