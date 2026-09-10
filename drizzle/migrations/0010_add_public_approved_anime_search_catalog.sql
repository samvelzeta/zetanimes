CREATE OR REPLACE FUNCTION public.list_approved_anime_search_catalog()
RETURNS TABLE (
  anilist_id integer,
  title text,
  slug text,
  cover_image text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT a.anilist_id
    FROM public.approved_animes a
    UNION
    SELECT v.anilist_id
    FROM public.video_cache v
    WHERE v.episode = 0
      AND jsonb_typeof(v.sources -> 'seeke') = 'array'
      AND jsonb_array_length(v.sources -> 'seeke') > 0
    UNION
    SELECT b.anilist_id
    FROM public.video_cache_blocks b
    WHERE nullif(b.seeke_base_url, '') IS NOT NULL
  ), catalog AS (
    SELECT
      e.anilist_id,
      coalesce(
        nullif(s.title, ''),
        nullif(vc.anime_title, ''),
        'Anime #' || e.anilist_id::text
      ) AS title,
      coalesce(nullif(s.manual_slug, ''), nullif(s.slug, ''), nullif(vc.slug, '')) AS slug,
      nullif(s.cover_image, '') AS cover_image
    FROM eligible e
    LEFT JOIN public.slugs s ON s.anilist_id = e.anilist_id
    LEFT JOIN LATERAL (
      SELECT v.anime_title, v.slug
      FROM public.video_cache v
      WHERE v.anilist_id = e.anilist_id
      ORDER BY (v.episode = 0) DESC, v.updated_at DESC
      LIMIT 1
    ) vc ON true
  )
  SELECT DISTINCT ON (c.anilist_id)
    c.anilist_id,
    c.title,
    c.slug,
    c.cover_image
  FROM catalog c
  ORDER BY c.anilist_id;
$$;

REVOKE ALL ON FUNCTION public.list_approved_anime_search_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_approved_anime_search_catalog() TO anon, authenticated, service_role;