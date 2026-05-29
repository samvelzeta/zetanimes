CREATE TABLE IF NOT EXISTS public.premium_plan_configs (
  slug text PRIMARY KEY CHECK (slug IN ('basico','solo','duo')),
  name text NOT NULL,
  price_label text NOT NULL,
  badge text,
  accent_color text NOT NULL DEFAULT '#FF4500',
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  ads_free boolean NOT NULL DEFAULT false,
  show_ads_free boolean NOT NULL DEFAULT true,
  quality_enabled boolean NOT NULL DEFAULT true,
  quality_max text NOT NULL DEFAULT 'hd' CHECK (quality_max IN ('hd','fhd','4k')),
  quality_label text NOT NULL DEFAULT 'Calidad HD',
  show_quality boolean NOT NULL DEFAULT true,
  streams_enabled boolean NOT NULL DEFAULT true,
  max_streams integer NOT NULL DEFAULT 1 CHECK (max_streams > 0),
  show_streams boolean NOT NULL DEFAULT true,
  profiles_enabled boolean NOT NULL DEFAULT true,
  max_profiles integer NOT NULL DEFAULT 1 CHECK (max_profiles > 0),
  show_profiles boolean NOT NULL DEFAULT true,
  pdf_export boolean NOT NULL DEFAULT false,
  show_pdf_export boolean NOT NULL DEFAULT false,
  downloads_allowed boolean NOT NULL DEFAULT false,
  show_downloads boolean NOT NULL DEFAULT false,
  priority_support boolean NOT NULL DEFAULT false,
  show_priority_support boolean NOT NULL DEFAULT false,
  vip_support boolean NOT NULL DEFAULT false,
  show_vip_support boolean NOT NULL DEFAULT false,
  priority_servers boolean NOT NULL DEFAULT false,
  show_priority_servers boolean NOT NULL DEFAULT false,
  multi_status_selection boolean NOT NULL DEFAULT false,
  custom_avatar_upload boolean NOT NULL DEFAULT false,
  inherited_from text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.premium_plan_configs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_plan_configs TO authenticated;
GRANT ALL ON public.premium_plan_configs TO service_role;

ALTER TABLE public.premium_plan_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read enabled premium plans" ON public.premium_plan_configs;
CREATE POLICY "Public can read enabled premium plans"
ON public.premium_plan_configs
FOR SELECT
TO anon, authenticated
USING (enabled = true OR public.has_role(auth.uid(), 'owner'::app_role));

DROP POLICY IF EXISTS "Owners can manage premium plans" ON public.premium_plan_configs;
CREATE POLICY "Owners can manage premium plans"
ON public.premium_plan_configs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_premium_plan_configs_updated_at
BEFORE UPDATE ON public.premium_plan_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.premium_plan_configs (
  slug, name, price_label, badge, accent_color, sort_order, enabled,
  ads_free, show_ads_free,
  quality_enabled, quality_max, quality_label, show_quality,
  streams_enabled, max_streams, show_streams,
  profiles_enabled, max_profiles, show_profiles,
  pdf_export, show_pdf_export,
  downloads_allowed, show_downloads,
  priority_support, show_priority_support,
  vip_support, show_vip_support,
  priority_servers, show_priority_servers,
  multi_status_selection, custom_avatar_upload,
  inherited_from
) VALUES
  ('basico', 'Básico', '$5/año', NULL, '#22C55E', 1, true,
   true, true,
   true, 'hd', 'Calidad HD', true,
   true, 1, true,
   true, 2, true,
   false, false,
   false, false,
   false, false,
   false, false,
   false, false,
   false, false,
   NULL),
  ('solo', 'Plan Solo', '$8/año', 'Popular', '#3B82F6', 2, true,
   true, false,
   true, 'hd', 'Calidad HD', false,
   true, 2, true,
   true, 3, true,
   true, true,
   true, true,
   true, true,
   false, false,
   false, false,
   true, true,
   'basico'),
  ('duo', 'Plan Dúo', '$10/año', 'Mejor valor', '#A855F7', 3, true,
   true, false,
   true, 'fhd', 'Calidad Full HD', true,
   true, 3, true,
   true, 3, true,
   true, false,
   true, false,
   true, false,
   true, true,
   false, false,
   true, true,
   'solo')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_label = EXCLUDED.price_label,
  badge = EXCLUDED.badge,
  accent_color = EXCLUDED.accent_color,
  sort_order = EXCLUDED.sort_order,
  enabled = EXCLUDED.enabled,
  ads_free = EXCLUDED.ads_free,
  show_ads_free = EXCLUDED.show_ads_free,
  quality_enabled = EXCLUDED.quality_enabled,
  quality_max = EXCLUDED.quality_max,
  quality_label = EXCLUDED.quality_label,
  show_quality = EXCLUDED.show_quality,
  streams_enabled = EXCLUDED.streams_enabled,
  max_streams = EXCLUDED.max_streams,
  show_streams = EXCLUDED.show_streams,
  profiles_enabled = EXCLUDED.profiles_enabled,
  max_profiles = EXCLUDED.max_profiles,
  show_profiles = EXCLUDED.show_profiles,
  pdf_export = EXCLUDED.pdf_export,
  show_pdf_export = EXCLUDED.show_pdf_export,
  downloads_allowed = EXCLUDED.downloads_allowed,
  show_downloads = EXCLUDED.show_downloads,
  priority_support = EXCLUDED.priority_support,
  show_priority_support = EXCLUDED.show_priority_support,
  vip_support = EXCLUDED.vip_support,
  show_vip_support = EXCLUDED.show_vip_support,
  priority_servers = EXCLUDED.priority_servers,
  show_priority_servers = EXCLUDED.show_priority_servers,
  multi_status_selection = EXCLUDED.multi_status_selection,
  custom_avatar_upload = EXCLUDED.custom_avatar_upload,
  inherited_from = EXCLUDED.inherited_from,
  updated_at = now();

ALTER TABLE public.broken_link_reporters
  ADD COLUMN IF NOT EXISTS plan_slug text,
  ADD COLUMN IF NOT EXISTS priority_label text,
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 0;

ALTER TABLE public.broken_link_reports
  ADD COLUMN IF NOT EXISTS highest_plan_slug text,
  ADD COLUMN IF NOT EXISTS highest_priority_label text,
  ADD COLUMN IF NOT EXISTS priority_score integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_broken_link_reports_priority
ON public.broken_link_reports(status, priority_score DESC, report_count DESC, last_reported_at DESC);

CREATE OR REPLACE FUNCTION public.get_user_max_streams(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(_user_id, 'owner'::app_role) THEN 999
    ELSE COALESCE((
      SELECT CASE WHEN ppc.enabled AND ppc.streams_enabled THEN ppc.max_streams ELSE 1 END
      FROM public.profiles p
      JOIN public.premium_plan_configs ppc ON ppc.slug = p.plan_type
      WHERE p.user_id = _user_id
        AND p.subscription_status = 'active'
        AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
      LIMIT 1
    ), 1)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_max_profiles(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(_user_id, 'owner'::app_role) THEN 99
    ELSE COALESCE((
      SELECT CASE WHEN ppc.enabled AND ppc.profiles_enabled THEN ppc.max_profiles ELSE 1 END
      FROM public.profiles p
      JOIN public.premium_plan_configs ppc ON ppc.slug = p.plan_type
      WHERE p.user_id = _user_id
        AND p.subscription_status = 'active'
        AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
      LIMIT 1
    ), 1)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_plan_slug(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(_user_id, 'owner'::app_role) THEN 'owner'
    ELSE COALESCE((
      SELECT p.plan_type
      FROM public.profiles p
      JOIN public.premium_plan_configs ppc ON ppc.slug = p.plan_type
      WHERE p.user_id = _user_id
        AND p.subscription_status = 'active'
        AND (p.subscription_expires_at IS NULL OR p.subscription_expires_at > now())
        AND ppc.enabled = true
      LIMIT 1
    ), 'free')
  END;
$function$;