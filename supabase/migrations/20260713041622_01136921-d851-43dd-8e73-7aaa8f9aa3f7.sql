
-- =========================================================
-- 1) RPC: leer video_cache SIN exponer sources.seeke
-- =========================================================
-- Devuelve las columnas normales pero con el array "seeke" removido de sources
-- y un flag booleano has_seeke para que el frontend sepa cuándo activar el
-- flujo protegido via edge function.
CREATE OR REPLACE FUNCTION public.get_video_cache_row(
  _slug text,
  _episode int,
  _lang text,
  _anilist_id int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  slug text,
  episode int,
  lang text,
  anilist_id int,
  anime_title text,
  sources jsonb,
  has_seeke boolean,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.slug,
    v.episode,
    v.lang,
    v.anilist_id,
    v.anime_title,
    (v.sources - 'seeke') AS sources,
    (jsonb_array_length(COALESCE(v.sources->'seeke','[]'::jsonb)) > 0) AS has_seeke,
    v.updated_at
  FROM public.video_cache v
  WHERE v.episode = _episode
    AND v.lang = _lang
    AND (
      (_anilist_id IS NOT NULL AND v.anilist_id = _anilist_id)
      OR (v.slug = lower(_slug))
    )
  ORDER BY v.updated_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_video_cache_row(text, int, text, int) TO anon, authenticated;

-- =========================================================
-- 2) RPC: leer bloques SIN exponer seeke_base_url
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_video_blocks_public(
  _anilist_id int,
  _lang text
)
RETURNS TABLE (
  id uuid,
  anilist_id int,
  slug text,
  lang text,
  block_index int,
  block_label text,
  episode_from int,
  episode_to int,
  source_episode_offset int,
  inverse_mode boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.anilist_id,
    b.slug,
    b.lang,
    b.block_index,
    b.block_label,
    b.episode_from,
    b.episode_to,
    COALESCE(b.source_episode_offset, 0)::int AS source_episode_offset,
    COALESCE(b.inverse_mode, false) AS inverse_mode
  FROM public.video_cache_blocks b
  WHERE b.anilist_id = _anilist_id
    AND b.lang = _lang
  ORDER BY b.block_index ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_video_blocks_public(int, text) TO anon, authenticated;

-- =========================================================
-- 3) RPC: ids con "enlace madre" para el Directory
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_anime_ids_with_seeke_master()
RETURNS TABLE (anilist_id int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT v.anilist_id
  FROM public.video_cache v
  WHERE v.episode = 0
    AND v.anilist_id IS NOT NULL
    AND jsonb_array_length(COALESCE(v.sources->'seeke','[]'::jsonb)) > 0
  UNION
  SELECT DISTINCT b.anilist_id
  FROM public.video_cache_blocks b
  WHERE b.anilist_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_anime_ids_with_seeke_master() TO anon, authenticated;

-- =========================================================
-- 4) RPC: listar animes doblados (para useDubbedAnimes)
--    No expone URLs, solo anilist_id + slug.
-- =========================================================
CREATE OR REPLACE FUNCTION public.list_dubbed_anime_ids()
RETURNS TABLE (anilist_id int, slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT v.anilist_id, v.slug
  FROM public.video_cache v
  WHERE v.lang = 'latino' AND v.anilist_id IS NOT NULL
  UNION
  SELECT DISTINCT b.anilist_id, b.slug
  FROM public.video_cache_blocks b
  WHERE b.lang = 'latino' AND b.anilist_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.list_dubbed_anime_ids() TO anon, authenticated;

-- =========================================================
-- 5) Lockdown de SELECT sobre video_cache_blocks
--    Solo owner/admin pueden leer la tabla directamente.
--    El público consume el RPC de arriba.
-- =========================================================
DROP POLICY IF EXISTS "Public can view video blocks" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "Anyone can view video blocks" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "public read video blocks" ON public.video_cache_blocks;
DROP POLICY IF EXISTS "Blocks are viewable by everyone" ON public.video_cache_blocks;

CREATE POLICY "Admins view video blocks"
ON public.video_cache_blocks
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- =========================================================
-- 6) Lockdown de SELECT sobre video_cache
--    La tabla queda restringida a owner/admin; el público lee vía RPC
--    get_video_cache_row (que enmascara seeke).
-- =========================================================
DROP POLICY IF EXISTS "Public can view video cache" ON public.video_cache;
DROP POLICY IF EXISTS "Anyone can view video cache" ON public.video_cache;
DROP POLICY IF EXISTS "public read video cache" ON public.video_cache;
DROP POLICY IF EXISTS "Video cache readable" ON public.video_cache;

CREATE POLICY "Admins view video cache"
ON public.video_cache
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'owner'::public.app_role)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
