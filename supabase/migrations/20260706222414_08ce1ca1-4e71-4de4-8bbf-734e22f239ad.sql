
CREATE TABLE IF NOT EXISTS public.anime_like_counts (
  anilist_id integer PRIMARY KEY,
  like_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anime_like_counts TO anon, authenticated;
GRANT ALL ON public.anime_like_counts TO service_role;

ALTER TABLE public.anime_like_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read like counts" ON public.anime_like_counts;
CREATE POLICY "Anyone can read like counts"
  ON public.anime_like_counts FOR SELECT
  USING (true);

-- Trigger function to sync counts
CREATE OR REPLACE FUNCTION public.sync_anime_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.anime_like_counts (anilist_id, like_count, updated_at)
    VALUES (NEW.anilist_id, 1, now())
    ON CONFLICT (anilist_id)
    DO UPDATE SET like_count = anime_like_counts.like_count + 1, updated_at = now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.anime_like_counts
      SET like_count = GREATEST(like_count - 1, 0), updated_at = now()
      WHERE anilist_id = OLD.anilist_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS anime_likes_sync_count ON public.anime_likes;
CREATE TRIGGER anime_likes_sync_count
AFTER INSERT OR DELETE ON public.anime_likes
FOR EACH ROW EXECUTE FUNCTION public.sync_anime_like_count();

-- Backfill counts from existing likes
INSERT INTO public.anime_like_counts (anilist_id, like_count, updated_at)
SELECT anilist_id, COUNT(*), now()
FROM public.anime_likes
GROUP BY anilist_id
ON CONFLICT (anilist_id)
DO UPDATE SET like_count = EXCLUDED.like_count, updated_at = now();

-- Rewrite RPC to use compact counter
CREATE OR REPLACE FUNCTION public.get_anime_like_count(_anilist_id integer)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT like_count FROM public.anime_like_counts WHERE anilist_id = _anilist_id),
    0
  )::bigint;
$$;
