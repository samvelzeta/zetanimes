
-- Índices para acelerar navegación/consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_watch_history_user_created ON public.watch_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_watch_history_profile_created ON public.watch_history (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_active ON public.notifications (created_at DESC) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_heartbeat ON public.streaming_sessions (last_heartbeat_at DESC);

-- Función de purga: watch_history >6m, notificaciones >90d, streaming_sessions ended >7d
CREATE OR REPLACE FUNCTION public.purge_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.watch_history WHERE created_at < now() - interval '6 months';
  DELETE FROM public.notifications  WHERE created_at < now() - interval '90 days';
  DELETE FROM public.streaming_sessions
    WHERE (ended_at IS NOT NULL AND ended_at < now() - interval '7 days')
       OR (ended_at IS NULL AND last_heartbeat_at < now() - interval '7 days');
  DELETE FROM public.notification_dismissals
    WHERE notification_id NOT IN (SELECT id FROM public.notifications);
END;
$$;

-- Cron diario 03:15 UTC
DO $$
BEGIN
  PERFORM cron.unschedule('purge_old_data_daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('purge_old_data_daily', '15 3 * * *', $$SELECT public.purge_old_data();$$);
