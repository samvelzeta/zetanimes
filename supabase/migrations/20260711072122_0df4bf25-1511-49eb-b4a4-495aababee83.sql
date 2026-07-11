-- Tabla para episodios detectados automáticamente de animes en emisión aprobados
CREATE TABLE IF NOT EXISTS public.auto_latest_episodes (
  anilist_id integer PRIMARY KEY,
  title text NOT NULL,
  cover text,
  banner text,
  latest_episode integer NOT NULL DEFAULT 0,
  previous_episode integer NOT NULL DEFAULT 0,
  anilist_status text,
  episode_updated_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.auto_latest_episodes TO anon, authenticated;
GRANT ALL ON public.auto_latest_episodes TO service_role;

ALTER TABLE public.auto_latest_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auto_latest_episodes readable by anyone"
  ON public.auto_latest_episodes FOR SELECT
  USING (true);

CREATE POLICY "auto_latest_episodes admin manage"
  ON public.auto_latest_episodes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_auto_latest_updated ON public.auto_latest_episodes(episode_updated_at DESC);

CREATE TRIGGER trg_auto_latest_updated_at
  BEFORE UPDATE ON public.auto_latest_episodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();