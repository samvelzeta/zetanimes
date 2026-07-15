
CREATE TABLE public.anime_synopsis_es (
  anilist_id integer PRIMARY KEY,
  translated_text text NOT NULL,
  source_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anime_synopsis_es TO anon, authenticated;
GRANT ALL ON public.anime_synopsis_es TO service_role;

ALTER TABLE public.anime_synopsis_es ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cache de sinopsis es publico para lectura"
  ON public.anime_synopsis_es FOR SELECT
  USING (true);

CREATE TRIGGER update_anime_synopsis_es_updated_at
  BEFORE UPDATE ON public.anime_synopsis_es
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
