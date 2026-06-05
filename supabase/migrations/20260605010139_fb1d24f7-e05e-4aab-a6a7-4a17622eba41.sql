
-- 1. Campo para no spamear aviso de expiración
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expiry_notice_sent_at timestamptz;

-- 2. Función de limpieza automática (libera espacio)
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_streams int;
  deleted_devices int;
  deleted_dismissals int;
  deleted_activity int;
BEGIN
  DELETE FROM public.streaming_sessions
    WHERE ended_at IS NOT NULL AND ended_at < now() - interval '7 days';
  GET DIAGNOSTICS deleted_streams = ROW_COUNT;

  DELETE FROM public.device_sessions
    WHERE revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_devices = ROW_COUNT;

  DELETE FROM public.notification_dismissals nd
    WHERE NOT EXISTS (SELECT 1 FROM public.notifications n WHERE n.id = nd.notification_id);
  GET DIAGNOSTICS deleted_dismissals = ROW_COUNT;

  DELETE FROM public.admin_activity_log
    WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_activity = ROW_COUNT;

  RETURN jsonb_build_object(
    'streams', deleted_streams,
    'devices', deleted_devices,
    'dismissals', deleted_dismissals,
    'activity', deleted_activity,
    'at', now()
  );
END;
$$;

-- 3. Auto-expirar premium cuando pasa la fecha
CREATE OR REPLACE FUNCTION public.auto_expire_subscriptions()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected int;
BEGIN
  WITH expired AS (
    UPDATE public.profiles
    SET subscription_status = 'expired',
        plan_type = NULL,
        subscription_updated_at = now(),
        updated_at = now()
    WHERE subscription_status = 'active'
      AND subscription_expires_at IS NOT NULL
      AND subscription_expires_at < now()
    RETURNING user_id
  )
  DELETE FROM public.user_roles
    WHERE role = 'premium'::app_role
      AND user_id IN (SELECT user_id FROM expired);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 4. Extensiones para cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
