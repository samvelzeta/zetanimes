-- Bajar límite de perfiles de 5 a 3
CREATE OR REPLACE FUNCTION public.enforce_max_profiles()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF (SELECT COUNT(*) FROM public.account_profiles WHERE user_id = NEW.user_id) >= 3 THEN
    RAISE EXCEPTION 'Máximo 3 perfiles por cuenta';
  END IF;
  RETURN NEW;
END;
$function$;

-- Asegurar trigger conectado (idempotente)
DROP TRIGGER IF EXISTS trg_enforce_max_profiles ON public.account_profiles;
CREATE TRIGGER trg_enforce_max_profiles
BEFORE INSERT ON public.account_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_profiles();

-- PIN individual por perfil
ALTER TABLE public.account_profiles
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS pin_enabled boolean NOT NULL DEFAULT false;