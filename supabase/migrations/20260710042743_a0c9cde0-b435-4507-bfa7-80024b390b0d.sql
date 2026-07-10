CREATE TABLE public.admin_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  requirement_type text NOT NULL DEFAULT 'free' CHECK (requirement_type IN ('free','level','premium')),
  requirement_value integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_banners TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_banners TO authenticated;
GRANT ALL ON public.admin_banners TO service_role;

ALTER TABLE public.admin_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active banners"
  ON public.admin_banners FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage banners"
  ON public.admin_banners FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_admin_banners_updated_at
  BEFORE UPDATE ON public.admin_banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_admin_banners_active_pos ON public.admin_banners(active, position);