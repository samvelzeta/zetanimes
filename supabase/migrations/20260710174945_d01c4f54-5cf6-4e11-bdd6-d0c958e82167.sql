
-- ============================================================
-- 1. UNIFICAR slug_cache + slug_overrides EN public.slugs
-- ============================================================

CREATE TABLE public.slugs (
  anilist_id INTEGER PRIMARY KEY,
  slug TEXT,
  manual_slug TEXT,
  title TEXT,
  cover_image TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.slugs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.slugs TO authenticated;
GRANT ALL ON public.slugs TO service_role;

ALTER TABLE public.slugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read slugs"
  ON public.slugs FOR SELECT USING (true);

CREATE POLICY "Owners can manage slugs"
  ON public.slugs FOR ALL
  USING (public.has_role(auth.uid(), 'owner'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::public.app_role));

CREATE TRIGGER trg_slugs_updated
  BEFORE UPDATE ON public.slugs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrar datos de slug_cache
INSERT INTO public.slugs (anilist_id, slug, title, created_at)
SELECT anilist_id, slug, title, created_at
FROM public.slug_cache
ON CONFLICT (anilist_id) DO NOTHING;

-- Fusionar overrides encima
INSERT INTO public.slugs (anilist_id, manual_slug, title, cover_image, notes, created_by, created_at, updated_at)
SELECT anilist_id, manual_slug, anime_title, cover_image, notes, created_by, created_at, updated_at
FROM public.slug_overrides
ON CONFLICT (anilist_id) DO UPDATE SET
  manual_slug = EXCLUDED.manual_slug,
  title       = COALESCE(public.slugs.title, EXCLUDED.title),
  cover_image = COALESCE(EXCLUDED.cover_image, public.slugs.cover_image),
  notes       = EXCLUDED.notes,
  created_by  = COALESCE(EXCLUDED.created_by, public.slugs.created_by),
  updated_at  = now();

DROP TABLE public.slug_cache;
DROP TABLE public.slug_overrides;

-- ============================================================
-- 2. FUSIONAR account_settings EN profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS trusted_until TIMESTAMPTZ;

UPDATE public.profiles p
SET pin_enabled   = COALESCE(s.pin_enabled, false),
    pin_hash      = s.pin_hash,
    trusted_until = s.trusted_until
FROM public.account_settings s
WHERE s.user_id = p.user_id;

DROP TABLE public.account_settings;
