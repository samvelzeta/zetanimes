
-- ============================================================
-- FASE 3.5: Progreso automático de misiones + reclamo manual
-- ============================================================

-- 1) user_missions: agregar claimed_at para separar completado de reclamado
ALTER TABLE public.user_missions
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- 2) roleplay_missions: bank/pool de misiones rotativas
ALTER TABLE public.roleplay_missions
  ADD COLUMN IF NOT EXISTS pool text NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS current_cycle_start timestamptz;

-- Marcar misiones actuales como current
UPDATE public.roleplay_missions SET pool='current' WHERE active = true;

-- 3) Insertar banco extendido de misiones (más difíciles, para rotación semanal)
INSERT INTO public.roleplay_missions (slug, title, description, type, target, xp_reward, icon, active, pool) VALUES
  -- DIARIAS difíciles
  ('daily_watch_5','Devora episodios','Completa 5 episodios en un solo día','daily',5,350,'flame',false,'bank'),
  ('daily_watch_8','Sesión intensa','Completa 8 episodios en un solo día','daily',8,600,'zap',false,'bank'),
  ('daily_explore_10','Curioso incansable','Abre la ficha de 10 animes distintos','daily',10,300,'search',false,'bank'),
  ('daily_add_list','Coleccionista','Agrega 3 animes a tus listas','daily',3,250,'library',false,'bank'),
  ('daily_dawn','Ritual del amanecer','Ve 1 episodio entre las 5am y 8am UTC','daily',1,400,'sun',false,'bank'),
  ('daily_late_marathon','Vigilia otaku','Ve 3 episodios entre las 0am y 4am','daily',3,500,'moon',false,'bank'),
  -- SEMANALES difíciles
  ('weekly_watch_35','Semana de fuego','Completa 35 episodios en la semana','weekly',35,2500,'flame',false,'bank'),
  ('weekly_watch_50','Modo hardcore','Completa 50 episodios en la semana','weekly',50,4000,'zap',false,'bank'),
  ('weekly_finish_5','Cazador de finales','Termina 5 animes distintos','weekly',5,3000,'trophy',false,'bank'),
  ('weekly_genres_5','Gourmet cultural','Ve episodios de 5 géneros diferentes','weekly',5,1800,'sparkles',false,'bank'),
  ('weekly_new_10','Descubridor','Empieza 10 animes que nunca habías visto','weekly',10,2000,'compass',false,'bank'),
  ('weekly_like_15','Fanático','Da like a 15 animes','weekly',15,1200,'heart',false,'bank'),
  ('weekly_marathon_10','Maratón absoluto','Ve 10 episodios seguidos del mismo anime','weekly',10,2200,'crown',false,'bank'),
  ('weekly_night_owl_7','Insomne devoto','Ve al menos 1 episodio de madrugada 7 días','weekly',7,2800,'moon',false,'bank')
ON CONFLICT (slug) DO NOTHING;

-- 4) Progreso automático: función que incrementa misiones activas relevantes
CREATE OR REPLACE FUNCTION public.tick_mission(_user_id uuid, _slug text, _delta int DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.roleplay_missions;
  cycle_start timestamptz;
  cur_progress int;
  cur_cycle timestamptz;
BEGIN
  SELECT * INTO m FROM public.roleplay_missions WHERE slug = _slug AND active = true;
  IF m.slug IS NULL THEN RETURN; END IF;

  cycle_start := CASE
    WHEN m.type = 'daily' THEN date_trunc('day', now())
    WHEN m.type = 'weekly' THEN date_trunc('week', now())
    ELSE date_trunc('day', now())
  END;

  SELECT progress, cycle_started_at INTO cur_progress, cur_cycle
    FROM public.user_missions WHERE user_id = _user_id AND mission_slug = _slug;

  -- Reset ciclo si expiró
  IF cur_cycle IS NULL OR cur_cycle < cycle_start THEN
    INSERT INTO public.user_missions(user_id, mission_slug, progress, cycle_started_at, completed_at, claimed_at)
    VALUES (_user_id, _slug, GREATEST(_delta,0), cycle_start, NULL, NULL)
    ON CONFLICT (user_id, mission_slug) DO UPDATE
      SET progress = GREATEST(_delta,0),
          cycle_started_at = cycle_start,
          completed_at = NULL,
          claimed_at = NULL;
  ELSE
    UPDATE public.user_missions
      SET progress = LEAST(m.target, progress + _delta),
          completed_at = CASE WHEN (progress + _delta) >= m.target AND completed_at IS NULL THEN now() ELSE completed_at END
      WHERE user_id = _user_id AND mission_slug = _slug;
  END IF;
END;
$$;

-- 5) Reclamo manual con validación
CREATE OR REPLACE FUNCTION public.claim_mission(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  um public.user_missions;
  m public.roleplay_missions;
  reward int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO m FROM public.roleplay_missions WHERE slug = _slug AND active = true;
  IF m.slug IS NULL THEN RETURN jsonb_build_object('ok',false,'reason','not_found'); END IF;
  SELECT * INTO um FROM public.user_missions WHERE user_id = uid AND mission_slug = _slug;
  IF um.user_id IS NULL OR um.progress < m.target OR um.completed_at IS NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','not_completed');
  END IF;
  IF um.claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok',false,'reason','already_claimed');
  END IF;
  reward := m.xp_reward;
  UPDATE public.user_missions SET claimed_at = now() WHERE user_id = uid AND mission_slug = _slug;
  PERFORM public.award_xp(uid, reward);
  RETURN jsonb_build_object('ok',true,'xp',reward);
END;
$$;

-- 6) Trigger de watch_history: alimenta misiones automáticamente
CREATE OR REPLACE FUNCTION public.on_watch_tick_missions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hr int;
BEGIN
  IF NEW.completed = true AND (TG_OP='INSERT' OR COALESCE(OLD.completed,false)=false) THEN
    -- Contadores diarios/semanales de episodios
    PERFORM public.tick_mission(NEW.user_id, 'daily_watch_3', 1);
    PERFORM public.tick_mission(NEW.user_id, 'daily_watch_5', 1);
    PERFORM public.tick_mission(NEW.user_id, 'daily_watch_8', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_watch_20', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_watch_35', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_watch_50', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_marathon', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_marathon_10', 1);

    hr := EXTRACT(hour FROM now() AT TIME ZONE 'UTC');
    IF hr BETWEEN 0 AND 6 THEN
      PERFORM public.tick_mission(NEW.user_id, 'daily_night', 1);
      PERFORM public.tick_mission(NEW.user_id, 'daily_late_marathon', 1);
      PERFORM public.tick_mission(NEW.user_id, 'weekly_night_owl_7', 1);
    END IF;
    IF hr BETWEEN 5 AND 8 THEN
      PERFORM public.tick_mission(NEW.user_id, 'daily_dawn', 1);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_watch_tick_missions ON public.watch_history;
CREATE TRIGGER on_watch_tick_missions
  AFTER INSERT OR UPDATE ON public.watch_history
  FOR EACH ROW EXECUTE FUNCTION public.on_watch_tick_missions();

-- 7) Trigger de anime_lists: coleccionismo + descubrimiento
CREATE OR REPLACE FUNCTION public.on_list_tick_missions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.tick_mission(NEW.user_id, 'daily_add_list', 1);
    IF NEW.status = 'watching' OR NEW.status = 'plan_to_watch' THEN
      PERFORM public.tick_mission(NEW.user_id, 'weekly_new_10', 1);
    END IF;
    IF NEW.status = 'completed' THEN
      PERFORM public.tick_mission(NEW.user_id, 'daily_finish_anime', 1);
      PERFORM public.tick_mission(NEW.user_id, 'weekly_finish_2', 1);
      PERFORM public.tick_mission(NEW.user_id, 'weekly_finish_5', 1);
    END IF;
  ELSIF TG_OP='UPDATE' AND NEW.status='completed' AND COALESCE(OLD.status,'') <> 'completed' THEN
    PERFORM public.tick_mission(NEW.user_id, 'daily_finish_anime', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_finish_2', 1);
    PERFORM public.tick_mission(NEW.user_id, 'weekly_finish_5', 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_list_tick_missions ON public.anime_lists;
CREATE TRIGGER on_list_tick_missions
  AFTER INSERT OR UPDATE ON public.anime_lists
  FOR EACH ROW EXECUTE FUNCTION public.on_list_tick_missions();

-- 8) Trigger de likes
CREATE OR REPLACE FUNCTION public.on_like_tick_missions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    PERFORM public.tick_mission(NEW.user_id, 'weekly_like_15', 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_like_tick_missions ON public.anime_likes;
CREATE TRIGGER on_like_tick_missions
  AFTER INSERT ON public.anime_likes
  FOR EACH ROW EXECUTE FUNCTION public.on_like_tick_missions();

-- 9) Rotación semanal: promueve N del banco a current, retira anteriores
CREATE OR REPLACE FUNCTION public.rotate_weekly_missions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  daily_slugs text[];
  weekly_slugs text[];
BEGIN
  -- Retirar semanales anteriores al banco
  UPDATE public.roleplay_missions SET active=false, pool='bank'
    WHERE type IN ('daily','weekly') AND pool='current';

  SELECT array_agg(slug) INTO daily_slugs FROM (
    SELECT slug FROM public.roleplay_missions WHERE type='daily' ORDER BY random() LIMIT 4
  ) x;
  SELECT array_agg(slug) INTO weekly_slugs FROM (
    SELECT slug FROM public.roleplay_missions WHERE type='weekly' ORDER BY random() LIMIT 4
  ) x;

  UPDATE public.roleplay_missions
    SET active=true, pool='current', current_cycle_start=now()
    WHERE slug = ANY(daily_slugs) OR slug = ANY(weekly_slugs);

  RETURN jsonb_build_object('daily', daily_slugs, 'weekly', weekly_slugs);
END;
$$;

-- 10) Backfill de progreso para episodios ya completados (esta semana / hoy)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT user_id, count(*) AS c FROM public.watch_history
    WHERE completed=true AND created_at >= date_trunc('week', now())
    GROUP BY user_id
  LOOP
    PERFORM public.tick_mission(r.user_id, 'weekly_watch_20', LEAST(20, r.c::int));
    PERFORM public.tick_mission(r.user_id, 'weekly_watch_35', LEAST(35, r.c::int));
  END LOOP;
END $$;
