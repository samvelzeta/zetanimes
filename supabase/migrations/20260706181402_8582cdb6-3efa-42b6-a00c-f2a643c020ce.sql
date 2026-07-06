CREATE TABLE public.approved_animes (
  anilist_id integer PRIMARY KEY,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.approved_animes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.approved_animes TO authenticated;
GRANT ALL ON public.approved_animes TO service_role;

ALTER TABLE public.approved_animes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_animes public read"
  ON public.approved_animes FOR SELECT
  USING (true);

CREATE POLICY "approved_animes admin insert"
  ON public.approved_animes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "approved_animes admin update"
  ON public.approved_animes FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "approved_animes admin delete"
  ON public.approved_animes FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_approved_animes_updated
  BEFORE UPDATE ON public.approved_animes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_approved_animes_created ON public.approved_animes(created_at DESC);