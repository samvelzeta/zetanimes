
-- 1. Ampliar premium_plans
ALTER TABLE public.premium_plans
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS price_monthly numeric,
  ADD COLUMN IF NOT EXISTS price_annual numeric,
  ADD COLUMN IF NOT EXISTS max_streams integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_profiles integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS quality_max text NOT NULL DEFAULT 'hd',
  ADD COLUMN IF NOT EXISTS ads_free boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority_servers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS downloads_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pdf_export boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_badge boolean NOT NULL DEFAULT false;

-- Backfill slug temporal para filas existentes
UPDATE public.premium_plans SET slug = 'legacy-' || id::text WHERE slug IS NULL;

ALTER TABLE public.premium_plans ALTER COLUMN slug SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'premium_plans_slug_key'
  ) THEN
    ALTER TABLE public.premium_plans ADD CONSTRAINT premium_plans_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 2. Seed planes oficiales
INSERT INTO public.premium_plans
  (slug, name, price_label, price_monthly, price_annual, period, membership_type, tier,
   profile_count, max_profiles, simultaneous_sessions, max_streams, quality_max,
   ads_free, priority_servers, downloads_allowed, pdf_export, premium_badge,
   features, badge, accent_color, sort_order, enabled)
VALUES
  ('solo', 'SOLO', '$2.99/mes', 2.99, 14.99, 'monthly', 'monthly', 'solo',
    2, 2, 1, 1, 'hd',
    true, false, false, false, true,
    '["Sin anuncios","Calidad HD","2 perfiles (no simultáneos)","1 reproducción a la vez"]'::jsonb,
    'POPULAR', '#3b82f6', 1, true),
  ('duo', 'DUO', '$4.99/mes', 4.99, 23.99, 'monthly', 'monthly', 'duo',
    2, 2, 2, 2, 'fhd',
    true, true, false, false, true,
    '["Sin anuncios","Calidad Full HD","2 perfiles","2 reproducciones simultáneas","Servidores prioritarios"]'::jsonb,
    'MEJOR VALOR', '#a855f7', 2, true),
  ('trio', 'TRIO', '$7.99/mes', 7.99, 34.99, 'monthly', 'monthly', 'trio',
    3, 3, 3, 3, '4k',
    true, true, true, true, true,
    '["Sin anuncios","Calidad 4K","3 perfiles","3 reproducciones simultáneas","Servidores prioritarios","Descargas","Exportar historial en PDF"]'::jsonb,
    'PREMIUM', '#f59e0b', 3, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_label = EXCLUDED.price_label,
  price_monthly = EXCLUDED.price_monthly,
  price_annual = EXCLUDED.price_annual,
  tier = EXCLUDED.tier,
  profile_count = EXCLUDED.profile_count,
  max_profiles = EXCLUDED.max_profiles,
  simultaneous_sessions = EXCLUDED.simultaneous_sessions,
  max_streams = EXCLUDED.max_streams,
  quality_max = EXCLUDED.quality_max,
  ads_free = EXCLUDED.ads_free,
  priority_servers = EXCLUDED.priority_servers,
  downloads_allowed = EXCLUDED.downloads_allowed,
  pdf_export = EXCLUDED.pdf_export,
  premium_badge = EXCLUDED.premium_badge,
  features = EXCLUDED.features,
  badge = EXCLUDED.badge,
  accent_color = EXCLUDED.accent_color,
  sort_order = EXCLUDED.sort_order,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- 3. streaming_sessions
CREATE TABLE IF NOT EXISTS public.streaming_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  profile_id uuid,
  anime_id integer,
  episode_number integer,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS streaming_sessions_user_active_idx
  ON public.streaming_sessions (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS streaming_sessions_user_device_idx
  ON public.streaming_sessions (user_id, device_id) WHERE ended_at IS NULL;

ALTER TABLE public.streaming_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own streams" ON public.streaming_sessions;
CREATE POLICY "Users view own streams" ON public.streaming_sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own streams" ON public.streaming_sessions;
CREATE POLICY "Users insert own streams" ON public.streaming_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own streams" ON public.streaming_sessions;
CREATE POLICY "Users update own streams" ON public.streaming_sessions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own streams" ON public.streaming_sessions;
CREATE POLICY "Users delete own streams" ON public.streaming_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Helpers
CREATE OR REPLACE FUNCTION public.get_user_plan_slug(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'owner'::app_role) THEN 'owner'
    ELSE COALESCE(
      (
        SELECT pp.slug
        FROM public.premium_memberships pm
        LEFT JOIN public.premium_plans pp ON pp.tier = pm.plan_tier
        WHERE pm.user_id = _user_id
          AND pm.status = 'active'
          AND (pm.expires_at IS NULL OR pm.expires_at > now())
        ORDER BY pm.updated_at DESC
        LIMIT 1
      ),
      'free'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_max_streams(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'owner'::app_role) THEN 999
    ELSE COALESCE(
      (SELECT max_streams FROM public.premium_plans WHERE slug = public.get_user_plan_slug(_user_id)),
      1
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_max_profiles(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(_user_id, 'owner'::app_role) THEN 99
    ELSE COALESCE(
      (SELECT max_profiles FROM public.premium_plans WHERE slug = public.get_user_plan_slug(_user_id)),
      1
    )
  END;
$$;

-- 5. RPCs streaming
CREATE OR REPLACE FUNCTION public.cleanup_stale_streams(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.streaming_sessions
  SET ended_at = now()
  WHERE user_id = _user_id
    AND ended_at IS NULL
    AND last_heartbeat_at < now() - interval '90 seconds';
$$;

CREATE OR REPLACE FUNCTION public.start_stream(
  _device_id text,
  _profile_id uuid,
  _anime_id integer,
  _episode_number integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  active_count integer;
  max_allowed integer;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  PERFORM public.cleanup_stale_streams(uid);

  UPDATE public.streaming_sessions
  SET ended_at = now()
  WHERE user_id = uid
    AND device_id = _device_id
    AND ended_at IS NULL;

  max_allowed := public.get_user_max_streams(uid);

  SELECT COUNT(*) INTO active_count
  FROM public.streaming_sessions
  WHERE user_id = uid AND ended_at IS NULL;

  IF active_count >= max_allowed THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', active_count,
      'limit', max_allowed
    );
  END IF;

  INSERT INTO public.streaming_sessions
    (user_id, device_id, profile_id, anime_id, episode_number)
  VALUES (uid, _device_id, _profile_id, _anime_id, _episode_number)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'session_id', new_id,
    'current', active_count + 1,
    'limit', max_allowed
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_stream(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET last_heartbeat_at = now()
  WHERE id = _session_id
    AND user_id = auth.uid()
    AND ended_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_stream(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET ended_at = now()
  WHERE id = _session_id
    AND user_id = auth.uid()
    AND ended_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_all_streams_except(_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streaming_sessions
  SET ended_at = now()
  WHERE user_id = auth.uid()
    AND ended_at IS NULL
    AND (_session_id IS NULL OR id <> _session_id);
END;
$$;

-- 6. enforce_max_profiles dinámico
CREATE OR REPLACE FUNCTION public.enforce_max_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_count integer;
  max_profiles integer;
BEGIN
  SELECT COUNT(*) INTO profile_count
  FROM public.account_profiles
  WHERE user_id = NEW.user_id;

  max_profiles := public.get_user_max_profiles(NEW.user_id);

  IF profile_count >= max_profiles THEN
    RAISE EXCEPTION 'Máximo % perfiles por cuenta para tu plan', max_profiles;
  END IF;

  IF NEW.is_default = true THEN
    UPDATE public.account_profiles
    SET is_default = false
    WHERE user_id = NEW.user_id;
  END IF;

  IF profile_count = 0 THEN
    NEW.is_default := true;
  END IF;

  RETURN NEW;
END;
$$;
