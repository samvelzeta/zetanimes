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
    OR NOT EXISTS (
      SELECT 1
      FROM public.device_sessions
      WHERE user_id = _user_id
        AND device_id = _device_id
    )
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