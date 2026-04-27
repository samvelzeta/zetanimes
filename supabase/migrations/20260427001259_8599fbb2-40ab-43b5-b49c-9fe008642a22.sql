CREATE OR REPLACE FUNCTION public.enforce_max_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_count integer;
  max_profiles integer := 2;
BEGIN
  SELECT COUNT(*) INTO profile_count
  FROM public.account_profiles
  WHERE user_id = NEW.user_id;

  IF public.has_role(NEW.user_id, 'owner'::app_role) THEN
    max_profiles := 99;
  ELSIF public.has_role(NEW.user_id, 'premium'::app_role) THEN
    max_profiles := 3;
  ELSE
    max_profiles := 2;
  END IF;

  IF profile_count >= max_profiles THEN
    RAISE EXCEPTION 'Máximo % perfiles por cuenta', max_profiles;
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

DROP TRIGGER IF EXISTS trg_enforce_max_profiles ON public.account_profiles;
CREATE TRIGGER trg_enforce_max_profiles
BEFORE INSERT ON public.account_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_profiles();

WITH ranked AS (
  SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at ASC) AS rn
  FROM public.account_profiles
)
UPDATE public.account_profiles ap
SET is_default = (ranked.rn = 1)
FROM ranked
WHERE ap.id = ranked.id;

DELETE FROM public.account_profiles ap
USING (
  SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at ASC) AS rn
  FROM public.account_profiles
  WHERE NOT public.has_role(user_id, 'owner'::app_role)
) ranked
WHERE ap.id = ranked.id
  AND (
    (public.has_role(ranked.user_id, 'premium'::app_role) AND ranked.rn > 3)
    OR (NOT public.has_role(ranked.user_id, 'premium'::app_role) AND ranked.rn > 2)
  );

CREATE OR REPLACE FUNCTION public.touch_device_session(
  _user_id uuid,
  _device_id text,
  _session_fingerprint text,
  _device_name text,
  _platform text,
  _user_agent text
)
RETURNS public.device_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.device_sessions;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.device_sessions (
    user_id, device_id, session_fingerprint, device_name, platform, user_agent, last_active_at, revoked_at
  ) VALUES (
    _user_id, _device_id, _session_fingerprint, _device_name, _platform, _user_agent, now(), NULL
  )
  ON CONFLICT (user_id, device_id)
  DO UPDATE SET
    session_fingerprint = EXCLUDED.session_fingerprint,
    device_name = EXCLUDED.device_name,
    platform = EXCLUDED.platform,
    user_agent = EXCLUDED.user_agent,
    last_active_at = now(),
    revoked_at = NULL
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_device_session_valid(
  _user_id uuid,
  _device_id text,
  _session_fingerprint text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = _user_id AND (
    public.has_role(_user_id, 'owner'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.device_sessions
      WHERE user_id = _user_id
        AND device_id = _device_id
        AND revoked_at IS NULL
        AND (
          session_fingerprint IS NULL
          OR _session_fingerprint IS NULL
          OR session_fingerprint = _session_fingerprint
        )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.revoke_device_session(
  _user_id uuid,
  _device_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.device_sessions
  SET revoked_at = now(), last_active_at = now()
  WHERE user_id = _user_id
    AND device_id = _device_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_all_device_sessions(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  UPDATE public.device_sessions
  SET revoked_at = now(), last_active_at = now()
  WHERE user_id = _user_id;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_anime_download_tracker_anilist_unique
ON public.anime_download_tracker(anilist_id);

CREATE OR REPLACE FUNCTION public.delete_download_tracker(_tracker_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.anime_episode_downloads WHERE tracker_id = _tracker_id;
  DELETE FROM public.anime_download_tracker WHERE id = _tracker_id;
END;
$$;