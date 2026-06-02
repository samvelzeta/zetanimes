CREATE OR REPLACE FUNCTION public.admin_set_user_subscription(
  _user_id uuid,
  _status text,
  _plan_type text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_allowed boolean;
BEGIN
  _is_allowed := public.has_role(auth.uid(), 'owner'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role);

  IF NOT _is_allowed THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF _status NOT IN ('active', 'inactive', 'expired') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  IF _status = 'active' AND _plan_type NOT IN ('basico', 'solo', 'duo') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  UPDATE public.profiles
  SET
    subscription_status = _status,
    plan_type = CASE WHEN _status = 'active' THEN _plan_type ELSE NULL END,
    subscription_expires_at = CASE WHEN _status = 'active' THEN _expires_at ELSE NULL END,
    subscription_updated_at = now(),
    updated_at = now()
  WHERE user_id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF _status = 'active' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_user_id, 'premium'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'premium'::public.app_role;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(uuid, text, text, timestamptz) TO authenticated;

ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.user_roles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_roles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
  END IF;
END $$;