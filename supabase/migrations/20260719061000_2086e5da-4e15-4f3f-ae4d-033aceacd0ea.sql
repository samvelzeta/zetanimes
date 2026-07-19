
DROP TABLE IF EXISTS public.latino_episodes CASCADE;

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_activity = ROW_COUNT;

  RETURN jsonb_build_object(
    'streams', deleted_streams,
    'devices', deleted_devices,
    'dismissals', deleted_dismissals,
    'activity', deleted_activity,
    'at', now()
  );
END;
$function$;

DELETE FROM public.admin_activity_log WHERE created_at < now() - interval '30 days';

CREATE INDEX IF NOT EXISTS idx_watch_history_profile_created
  ON public.watch_history(profile_id, created_at DESC);
