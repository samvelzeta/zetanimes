ALTER TABLE public.device_sessions
ADD COLUMN IF NOT EXISTS session_fingerprint text,
ADD COLUMN IF NOT EXISTS revoked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_device_sessions_user_device
ON public.device_sessions (user_id, device_id);

CREATE INDEX IF NOT EXISTS idx_device_sessions_user_fingerprint
ON public.device_sessions (user_id, session_fingerprint)
WHERE session_fingerprint IS NOT NULL;

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
  INSERT INTO public.device_sessions (
    user_id,
    device_id,
    session_fingerprint,
    device_name,
    platform,
    user_agent,
    last_active_at,
    revoked_at
  ) VALUES (
    _user_id,
    _device_id,
    _session_fingerprint,
    _device_name,
    _platform,
    _user_agent,
    now(),
    NULL
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
  SELECT EXISTS (
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
  UPDATE public.device_sessions
  SET revoked_at = now(), last_active_at = now()
  WHERE user_id = _user_id;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.device_sessions;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;