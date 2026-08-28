CREATE TABLE IF NOT EXISTS public.adult_animes (
  anilist_id INTEGER PRIMARY KEY,
  title TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adult_animes TO authenticated;
GRANT SELECT ON public.adult_animes TO anon;
GRANT ALL ON public.adult_animes TO service_role;

ALTER TABLE public.adult_animes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read adult flags" ON public.adult_animes FOR SELECT USING (true);
CREATE POLICY "Authenticated can flag adult" ON public.adult_animes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can update adult flags" ON public.adult_animes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));
CREATE POLICY "Admins can delete adult flags" ON public.adult_animes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));