
CREATE TABLE public.video_cache_blocks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id integer NOT NULL,
  slug text NOT NULL,
  lang text NOT NULL DEFAULT 'sub',
  block_index integer NOT NULL,
  block_label text,
  episode_from integer NOT NULL,
  episode_to integer NOT NULL,
  seeke_base_url text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_cache_blocks_range_check CHECK (episode_to >= episode_from),
  CONSTRAINT video_cache_blocks_unique UNIQUE (anilist_id, lang, block_index)
);

CREATE INDEX idx_video_cache_blocks_lookup ON public.video_cache_blocks (anilist_id, lang, block_index);

ALTER TABLE public.video_cache_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocks"
ON public.video_cache_blocks FOR SELECT
USING (true);

CREATE POLICY "Admins can manage blocks"
ON public.video_cache_blocks FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can manage blocks"
ON public.video_cache_blocks FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_video_cache_blocks_updated
BEFORE UPDATE ON public.video_cache_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
