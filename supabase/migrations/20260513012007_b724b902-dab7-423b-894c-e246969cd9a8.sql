
ALTER TABLE public.video_cache_blocks
  ADD COLUMN IF NOT EXISTS source_episode_offset integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inverse_mode boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ranking_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL,
  anilist_id integer NOT NULL,
  anime_title text,
  cover_image text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position)
);

ALTER TABLE public.ranking_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ranking overrides"
  ON public.ranking_overrides FOR SELECT USING (true);

CREATE POLICY "Admins manage ranking overrides"
  ON public.ranking_overrides FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners manage ranking overrides"
  ON public.ranking_overrides FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_ranking_overrides_updated_at
  BEFORE UPDATE ON public.ranking_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.app_settings (key, value, description)
  VALUES ('ranking_auto_update', 'true', 'If true, TopRanking ignores manual overrides and uses dynamic source.')
  ON CONFLICT (key) DO NOTHING;
