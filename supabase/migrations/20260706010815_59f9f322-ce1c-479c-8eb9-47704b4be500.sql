
CREATE TABLE public.anime_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  anilist_id integer NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, anilist_id)
);

CREATE INDEX idx_anime_likes_anilist ON public.anime_likes (anilist_id);

GRANT SELECT, INSERT, DELETE ON public.anime_likes TO authenticated;
GRANT ALL ON public.anime_likes TO service_role;

ALTER TABLE public.anime_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read likes authenticated"
  ON public.anime_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "insert own like"
  ON public.anime_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete own like"
  ON public.anime_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_anime_like_count(_anilist_id integer)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint FROM public.anime_likes WHERE anilist_id = _anilist_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_anime_like_count(integer) TO anon, authenticated;
