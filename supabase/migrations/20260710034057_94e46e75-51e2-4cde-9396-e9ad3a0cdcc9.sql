
-- 1) Tabla agregada ultra ligera
CREATE TABLE IF NOT EXISTS public.profile_stats (
  user_id uuid NOT NULL,
  profile_id uuid NULL,
  episodes_completed integer NOT NULL DEFAULT 0,
  total_watch_seconds bigint NOT NULL DEFAULT 0,
  lists_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único que trata NULL como un valor concreto para el UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS profile_stats_user_profile_uidx
  ON public.profile_stats (user_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS profile_stats_user_idx ON public.profile_stats(user_id);

GRANT SELECT ON public.profile_stats TO authenticated;
GRANT ALL ON public.profile_stats TO service_role;

ALTER TABLE public.profile_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own stats" ON public.profile_stats;
CREATE POLICY "Users read own stats" ON public.profile_stats
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2) Helper de upsert atómico (bump episodios + segundos + listas)
CREATE OR REPLACE FUNCTION public.bump_profile_stats(
  _user_id uuid,
  _profile_id uuid,
  _episodes_delta integer,
  _seconds_delta bigint,
  _lists_delta integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.profile_stats (user_id, profile_id, episodes_completed, total_watch_seconds, lists_count, updated_at)
  VALUES (_user_id, _profile_id, GREATEST(_episodes_delta, 0), GREATEST(_seconds_delta, 0), GREATEST(_lists_delta, 0), now())
  ON CONFLICT (user_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET
    episodes_completed = GREATEST(public.profile_stats.episodes_completed + _episodes_delta, 0),
    total_watch_seconds = GREATEST(public.profile_stats.total_watch_seconds + _seconds_delta, 0),
    lists_count = GREATEST(public.profile_stats.lists_count + _lists_delta, 0),
    updated_at = now();
END;
$$;

-- 3) Trigger sobre watch_history
CREATE OR REPLACE FUNCTION public.sync_watch_history_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eps_delta integer := 0;
  secs_delta bigint := 0;
  old_secs bigint := 0;
  new_secs bigint := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    eps_delta := CASE WHEN NEW.completed THEN 1 ELSE 0 END;
    secs_delta := COALESCE(NEW.watch_duration_seconds, 0);
    PERFORM public.bump_profile_stats(NEW.user_id, NEW.profile_id, eps_delta, secs_delta, 0);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    old_secs := COALESCE(OLD.watch_duration_seconds, 0);
    new_secs := COALESCE(NEW.watch_duration_seconds, 0);
    secs_delta := new_secs - old_secs;
    IF NEW.completed AND NOT COALESCE(OLD.completed, false) THEN eps_delta := 1;
    ELSIF COALESCE(OLD.completed, false) AND NOT NEW.completed THEN eps_delta := -1;
    END IF;
    -- Si cambia el profile_id (raro), primero descontamos del viejo y sumamos al nuevo
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      PERFORM public.bump_profile_stats(OLD.user_id, OLD.profile_id,
        CASE WHEN OLD.completed THEN -1 ELSE 0 END,
        -old_secs, 0);
      PERFORM public.bump_profile_stats(NEW.user_id, NEW.profile_id,
        CASE WHEN NEW.completed THEN 1 ELSE 0 END,
        new_secs, 0);
    ELSE
      IF eps_delta <> 0 OR secs_delta <> 0 THEN
        PERFORM public.bump_profile_stats(NEW.user_id, NEW.profile_id, eps_delta, secs_delta, 0);
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    eps_delta := CASE WHEN OLD.completed THEN -1 ELSE 0 END;
    secs_delta := -COALESCE(OLD.watch_duration_seconds, 0);
    PERFORM public.bump_profile_stats(OLD.user_id, OLD.profile_id, eps_delta, secs_delta, 0);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_watch_history_stats ON public.watch_history;
CREATE TRIGGER trg_sync_watch_history_stats
AFTER INSERT OR UPDATE OR DELETE ON public.watch_history
FOR EACH ROW EXECUTE FUNCTION public.sync_watch_history_stats();

-- 4) Trigger sobre anime_lists (para lists_count)
CREATE OR REPLACE FUNCTION public.sync_anime_lists_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.bump_profile_stats(NEW.user_id, NEW.profile_id, 0, 0, 1);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.bump_profile_stats(OLD.user_id, OLD.profile_id, 0, 0, -1);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.profile_id IS DISTINCT FROM OLD.profile_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      PERFORM public.bump_profile_stats(OLD.user_id, OLD.profile_id, 0, 0, -1);
      PERFORM public.bump_profile_stats(NEW.user_id, NEW.profile_id, 0, 0, 1);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_anime_lists_stats ON public.anime_lists;
CREATE TRIGGER trg_sync_anime_lists_stats
AFTER INSERT OR UPDATE OR DELETE ON public.anime_lists
FOR EACH ROW EXECUTE FUNCTION public.sync_anime_lists_stats();

-- 5) Backfill inicial desde datos existentes
TRUNCATE public.profile_stats;

INSERT INTO public.profile_stats (user_id, profile_id, episodes_completed, total_watch_seconds, lists_count, updated_at)
SELECT
  user_id,
  profile_id,
  COALESCE(SUM(CASE WHEN completed THEN 1 ELSE 0 END), 0)::int AS episodes_completed,
  COALESCE(SUM(watch_duration_seconds), 0)::bigint AS total_watch_seconds,
  0 AS lists_count,
  now()
FROM public.watch_history
GROUP BY user_id, profile_id
ON CONFLICT (user_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET
  episodes_completed = EXCLUDED.episodes_completed,
  total_watch_seconds = EXCLUDED.total_watch_seconds,
  updated_at = now();

INSERT INTO public.profile_stats (user_id, profile_id, episodes_completed, total_watch_seconds, lists_count, updated_at)
SELECT
  user_id,
  profile_id,
  0, 0,
  COUNT(*)::int AS lists_count,
  now()
FROM public.anime_lists
GROUP BY user_id, profile_id
ON CONFLICT (user_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET
  lists_count = EXCLUDED.lists_count,
  updated_at = now();

-- 6) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_stats;
