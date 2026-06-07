CREATE TABLE IF NOT EXISTS public.anime_status_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id integer NOT NULL UNIQUE,
  anime_title text,
  cover_image text,
  manual_status text NOT NULL CHECK (manual_status IN ('RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED', 'HIATUS')),
  notes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anime_status_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.anime_status_overrides TO authenticated;
GRANT ALL ON public.anime_status_overrides TO service_role;

ALTER TABLE public.anime_status_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read anime status overrides"
  ON public.anime_status_overrides
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage anime status overrides"
  ON public.anime_status_overrides
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

DROP TRIGGER IF EXISTS update_anime_status_overrides_updated_at ON public.anime_status_overrides;
CREATE TRIGGER update_anime_status_overrides_updated_at
  BEFORE UPDATE ON public.anime_status_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();