-- Prevent self-service privilege escalation: users must not be able to change
-- their own subscription/premium columns via a direct PostgREST update.
CREATE OR REPLACE FUNCTION public.protect_profile_subscription_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _jwt_role text;
  _privileged boolean;
BEGIN
  _jwt_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role')
  );

  -- Privileged paths: service_role / server-side (no end-user JWT), or owner/admin users.
  _privileged := (_jwt_role IS NULL OR _jwt_role NOT IN ('authenticated', 'anon'))
    OR (auth.uid() IS NOT NULL AND (
          public.has_role(auth.uid(), 'owner'::app_role)
       OR public.has_role(auth.uid(), 'admin'::app_role)
    ));

  IF _privileged THEN
    RETURN NEW;
  END IF;

  -- Revert any attempt to modify subscription-related columns.
  NEW.subscription_status    := OLD.subscription_status;
  NEW.plan_type              := OLD.plan_type;
  NEW.subscription_email     := OLD.subscription_email;
  NEW.subscription_expires_at:= OLD.subscription_expires_at;
  NEW.subscription_updated_at:= OLD.subscription_updated_at;
  NEW.expiry_notice_sent_at  := OLD.expiry_notice_sent_at;
  NEW.trusted_until          := OLD.trusted_until;
  NEW.user_id                := OLD.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_subscription_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_subscription_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_subscription_columns();