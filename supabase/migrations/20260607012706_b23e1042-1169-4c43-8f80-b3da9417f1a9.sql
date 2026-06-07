CREATE OR REPLACE FUNCTION public.auto_hide_anime(
  _anilist_id integer,
  _anime_title text,
  _reason text,
  _country_of_origin text DEFAULT NULL,
  _tags jsonb DEFAULT '[]'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _anilist_id IS NULL OR _anilist_id <= 0 THEN
    RAISE EXCEPTION 'invalid_anilist_id';
  END IF;

  IF _reason NOT IN ('Origen China', 'Etiqueta Chibi') THEN
    RAISE EXCEPTION 'invalid_reason';
  END IF;

  INSERT INTO public.hidden_home_animes (
    anilist_id,
    anime_title,
    reason,
    country_of_origin,
    tags,
    auto_hidden,
    source,
    is_hidden
  ) VALUES (
    _anilist_id,
    LEFT(COALESCE(_anime_title, ''), 300),
    _reason,
    NULLIF(LEFT(COALESCE(_country_of_origin, ''), 10), ''),
    COALESCE(_tags, '[]'::jsonb),
    true,
    'anilist-filter',
    true
  )
  ON CONFLICT (anilist_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_hide_anime(integer, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_hide_anime(integer, text, text, text, jsonb) TO anon, authenticated, service_role;