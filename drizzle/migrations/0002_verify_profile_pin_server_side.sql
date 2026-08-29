CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.verify_profile_pin(_profile_id uuid, _pin text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _row public.account_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO _row
  FROM public.account_profiles
  WHERE id = _profile_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(_row.pin_enabled, false) OR _row.pin_hash IS NULL THEN
    RETURN true;
  END IF;

  IF _pin IS NULL OR _pin !~ '^\d{4}$' THEN
    RETURN false;
  END IF;

  RETURN _row.pin_hash = encode(
    extensions.digest('zet-profile:' || _profile_id::text || ':' || _pin, 'sha256'),
    'hex'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_profile_pin(uuid, text) TO authenticated;

-- El hash del PIN nunca debe viajar al navegador.
REVOKE SELECT (pin_hash) ON public.account_profiles FROM authenticated;
REVOKE SELECT (pin_hash) ON public.account_profiles FROM anon;