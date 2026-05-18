
-- Plan tier metadata
ALTER TABLE public.premium_plans
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS profile_count integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS simultaneous_sessions integer NOT NULL DEFAULT 1;

ALTER TABLE public.premium_memberships
  ADD COLUMN IF NOT EXISTS plan_tier text,
  ADD COLUMN IF NOT EXISTS simultaneous_sessions integer;

-- Modal premium extras
ALTER TABLE public.premium_settings
  ADD COLUMN IF NOT EXISTS character_hover_text_1 text,
  ADD COLUMN IF NOT EXISTS character_hover_text_2 text,
  ADD COLUMN IF NOT EXISTS character3_image_url text,
  ADD COLUMN IF NOT EXISTS character_hover_text_3 text,
  ADD COLUMN IF NOT EXISTS companion_prompt text DEFAULT 'Elige al personaje que te acompañará en esta aventura';

-- Update enforce_max_profiles: free=2, premium=4
CREATE OR REPLACE FUNCTION public.enforce_max_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    max_profiles := 4;
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
$function$;
