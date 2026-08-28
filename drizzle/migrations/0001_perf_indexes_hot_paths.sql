-- Índices para las consultas más costosas detectadas en pg_stat_statements

-- 1) watch_history: búsqueda del registro existente antes de cada guardado de progreso
CREATE INDEX IF NOT EXISTS idx_watch_history_lookup
  ON public.watch_history (user_id, anime_id, episode_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watch_history_user_created
  ON public.watch_history (user_id, created_at DESC);

-- 2) hidden_home_animes: filtro is_hidden = true en cada carga de Home
CREATE INDEX IF NOT EXISTS idx_hidden_home_animes_hidden
  ON public.hidden_home_animes (anilist_id)
  WHERE is_hidden = true;

-- 3) video_cache: enlaces madre Seeke (episode = 0) y búsquedas por slug/episodio/idioma
CREATE INDEX IF NOT EXISTS idx_video_cache_master
  ON public.video_cache (anilist_id)
  WHERE episode = 0;

CREATE INDEX IF NOT EXISTS idx_video_cache_slug_ep_lang
  ON public.video_cache (slug, episode, lang);

-- 4) notifications: listado activo ordenado por fecha
CREATE INDEX IF NOT EXISTS idx_notifications_active_created
  ON public.notifications (created_at DESC)
  WHERE active = true;

-- 5) pending_anime_reserve: estado + prioridad
CREATE INDEX IF NOT EXISTS idx_pending_reserve_state_priority
  ON public.pending_anime_reserve (reserve_state, priority DESC, last_seen_at DESC);

-- 6) anime_download_tracker: filtro por estado en admin
CREATE INDEX IF NOT EXISTS idx_download_tracker_status
  ON public.anime_download_tracker (status);

-- 7) video_cache_blocks: resolución por anime + idioma
CREATE INDEX IF NOT EXISTS idx_video_cache_blocks_anime_lang
  ON public.video_cache_blocks (anilist_id, lang, block_index);

-- 8) streaming_sessions: limpieza y conteo de sesiones activas
CREATE INDEX IF NOT EXISTS idx_streaming_sessions_active
  ON public.streaming_sessions (user_id, last_heartbeat_at DESC)
  WHERE ended_at IS NULL;

-- 9) device_sessions: listado de dispositivos activos
CREATE INDEX IF NOT EXISTS idx_device_sessions_active
  ON public.device_sessions (user_id, last_active_at DESC)
  WHERE revoked_at IS NULL;
