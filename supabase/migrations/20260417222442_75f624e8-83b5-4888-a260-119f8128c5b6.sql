CREATE TABLE public.episode_count_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id INTEGER NOT NULL UNIQUE,
  anime_title TEXT,
  episode_count INTEGER NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.episode_count_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read episode overrides"
ON public.episode_count_overrides FOR SELECT USING (true);

CREATE POLICY "Owners can manage episode overrides"
ON public.episode_count_overrides FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_episode_overrides_updated_at
BEFORE UPDATE ON public.episode_count_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_episode_overrides_anilist ON public.episode_count_overrides(anilist_id);