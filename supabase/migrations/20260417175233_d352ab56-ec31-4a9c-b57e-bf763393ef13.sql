-- Tabla cache global de videos guardados desde admin (animes <12 eps prioridad)
CREATE TABLE public.video_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  episode INTEGER NOT NULL,
  lang TEXT NOT NULL DEFAULT 'sub',
  anilist_id INTEGER,
  anime_title TEXT,
  sources JSONB NOT NULL DEFAULT '{"hls":[],"mp4":[],"embed":[]}'::jsonb,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(slug, episode, lang)
);

CREATE INDEX idx_video_cache_lookup ON public.video_cache(slug, episode, lang);
CREATE INDEX idx_video_cache_anilist ON public.video_cache(anilist_id);

ALTER TABLE public.video_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read video cache"
  ON public.video_cache FOR SELECT
  USING (true);

CREATE POLICY "Owners can manage video cache"
  ON public.video_cache FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_video_cache_updated
  BEFORE UPDATE ON public.video_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla overrides manuales de slugs por anilist_id (gestor admin)
CREATE TABLE public.slug_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id INTEGER NOT NULL UNIQUE,
  anime_title TEXT,
  cover_image TEXT,
  manual_slug TEXT NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_slug_overrides_anilist ON public.slug_overrides(anilist_id);

ALTER TABLE public.slug_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read slug overrides"
  ON public.slug_overrides FOR SELECT
  USING (true);

CREATE POLICY "Owners can manage slug overrides"
  ON public.slug_overrides FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_slug_overrides_updated
  BEFORE UPDATE ON public.slug_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla animes ocultos del home (admin curation)
CREATE TABLE public.hidden_home_animes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id INTEGER NOT NULL UNIQUE,
  anime_title TEXT,
  reason TEXT,
  hidden_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_hidden_home_anilist ON public.hidden_home_animes(anilist_id);

ALTER TABLE public.hidden_home_animes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read hidden animes"
  ON public.hidden_home_animes FOR SELECT
  USING (true);

CREATE POLICY "Owners can manage hidden animes"
  ON public.hidden_home_animes FOR ALL
  USING (has_role(auth.uid(), 'owner'::app_role));

-- Notificaciones: read-receipt para no repetir
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_notification_id UUID;