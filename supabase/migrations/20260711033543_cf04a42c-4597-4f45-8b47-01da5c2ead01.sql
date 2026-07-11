
-- 1) anime_likes: restrict read to owner
DROP POLICY IF EXISTS "read likes authenticated" ON public.anime_likes;
CREATE POLICY "read own likes"
  ON public.anime_likes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) video_cache: drop anon/public SELECT policies, keep authenticated-only
DROP POLICY IF EXISTS "Anyone can read video cache" ON public.video_cache;
DROP POLICY IF EXISTS "Public can read video_cache" ON public.video_cache;

-- 3) video_cache_blocks: same
DROP POLICY IF EXISTS "Anyone can read blocks" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "Public can read video_cache_blocks" ON public.video_cache_blocks;

-- 4) Fix mutable search_path on two SQL functions
CREATE OR REPLACE FUNCTION public.calc_level_from_xp(_xp bigint)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT LEAST(150, GREATEST(1, floor(sqrt(GREATEST(_xp, 0)::numeric / 25))::int + 1));
$function$;

CREATE OR REPLACE FUNCTION public.calc_rank_from_level(_level integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _level >= 100 THEN 'hokage'
    WHEN _level >= 81  THEN 'kage'
    WHEN _level >= 51  THEN 'anbu'
    WHEN _level >= 26  THEN 'jounin'
    WHEN _level >= 11  THEN 'chunin'
    ELSE 'genin'
  END;
$function$;
