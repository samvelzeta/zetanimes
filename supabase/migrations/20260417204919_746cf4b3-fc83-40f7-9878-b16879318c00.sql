-- Tabla de vistas por anime (formato liviano: 1 fila por anilist_id)
CREATE TABLE IF NOT EXISTS public.anime_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anilist_id integer NOT NULL UNIQUE,
  view_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anime_views_anilist ON public.anime_views(anilist_id);

ALTER TABLE public.anime_views ENABLE ROW LEVEL SECURITY;

-- Lectura pública
DROP POLICY IF EXISTS "Anyone can read views" ON public.anime_views;
CREATE POLICY "Anyone can read views"
  ON public.anime_views FOR SELECT
  USING (true);

-- Solo dueños pueden modificar manualmente (la función SECURITY DEFINER hará los inserts/updates reales)
DROP POLICY IF EXISTS "Owners manage views" ON public.anime_views;
CREATE POLICY "Owners manage views"
  ON public.anime_views FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Función para incrementar vista (UPSERT atómico)
CREATE OR REPLACE FUNCTION public.increment_anime_view(_anilist_id integer)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count bigint;
BEGIN
  INSERT INTO public.anime_views (anilist_id, view_count, updated_at)
  VALUES (_anilist_id, 1, now())
  ON CONFLICT (anilist_id)
  DO UPDATE SET view_count = anime_views.view_count + 1, updated_at = now()
  RETURNING view_count INTO new_count;
  RETURN new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_anime_view(integer) TO anon, authenticated;