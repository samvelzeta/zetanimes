
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS subscription_email text,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_updated_at timestamptz DEFAULT now();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('active','inactive','expired'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_type_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_type_check
  CHECK (plan_type IS NULL OR plan_type IN ('basico','solo','duo'));

CREATE INDEX IF NOT EXISTS idx_profiles_subscription_email ON public.profiles(subscription_email);

DROP FUNCTION IF EXISTS public.get_user_plan_slug(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_max_streams(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_max_profiles(uuid) CASCADE;

DROP TABLE IF EXISTS public.premium_memberships CASCADE;
DROP TABLE IF EXISTS public.premium_requests CASCADE;
DROP TABLE IF EXISTS public.premium_plans CASCADE;
DROP TABLE IF EXISTS public.premium_settings CASCADE;
DROP TABLE IF EXISTS public.admin_payment_info CASCADE;

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
        SELECT CASE
          WHEN subscription_status = 'active'
            AND (subscription_expires_at IS NULL OR subscription_expires_at > now())
          THEN plan_type
          ELSE 'free'
        END
        FROM public.profiles
        WHERE user_id = _user_id
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
  SELECT CASE public.get_user_plan_slug(_user_id)
    WHEN 'owner' THEN 999
    WHEN 'duo'   THEN 3
    WHEN 'solo'  THEN 2
    WHEN 'basico' THEN 1
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_max_profiles(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE public.get_user_plan_slug(_user_id)
    WHEN 'owner' THEN 99
    WHEN 'duo'   THEN 5
    WHEN 'solo'  THEN 3
    WHEN 'basico' THEN 2
    ELSE 1
  END;
$$;
