
-- Requiere >=20 min (1200s) reales de reproducción para dar XP, logros y fichas.
-- Ficha Z cada 5 episodios completados (en lugar de cada 20).
CREATE OR REPLACE FUNCTION public.on_watch_completed_award()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  eps_total integer;
  plan_slug text;
  xp_award integer;
  min_seconds constant integer := 1200; -- 20 minutos
BEGIN
  IF NEW.completed = true AND (TG_OP = 'INSERT' OR COALESCE(OLD.completed, false) = false) THEN
    -- Anti-abuso: exige al menos 20 min reales de reproducción.
    IF COALESCE(NEW.watch_duration_seconds, 0) < min_seconds THEN
      RETURN NEW;
    END IF;

    plan_slug := public.get_user_plan_slug(NEW.user_id);
    xp_award := CASE plan_slug
      WHEN 'duo'    THEN 45
      WHEN 'solo'   THEN 36
      WHEN 'basico' THEN 33
      WHEN 'free'   THEN 15
      ELSE 30
    END;

    PERFORM public.award_xp(NEW.user_id, xp_award);

    SELECT COALESCE(SUM(episodes_completed), 0) INTO eps_total
    FROM public.profile_stats WHERE user_id = NEW.user_id;

    IF eps_total >= 1   THEN PERFORM public.unlock_achievement(NEW.user_id, 'first_step'); END IF;
    IF eps_total >= 10  THEN PERFORM public.unlock_achievement(NEW.user_id, 'ten_episodes'); END IF;
    IF eps_total >= 50  THEN PERFORM public.unlock_achievement(NEW.user_id, 'fifty_episodes'); END IF;
    IF eps_total >= 100 THEN PERFORM public.unlock_achievement(NEW.user_id, 'hundred_episodes'); END IF;
    IF eps_total >= 500 THEN PERFORM public.unlock_achievement(NEW.user_id, 'otaku_master'); END IF;

    IF EXTRACT(hour FROM now() AT TIME ZONE 'UTC') BETWEEN 2 AND 6 THEN
      PERFORM public.unlock_achievement(NEW.user_id, 'night_owl');
    END IF;

    -- Ficha Z cada 5 episodios efectivamente vistos.
    IF eps_total > 0 AND (eps_total % 5) = 0 THEN
      INSERT INTO public.user_gacha_tokens (user_id, tokens, total_earned, last_awarded_at, updated_at)
      VALUES (NEW.user_id, 1, 1, now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        tokens = public.user_gacha_tokens.tokens + 1,
        total_earned = public.user_gacha_tokens.total_earned + 1,
        last_awarded_at = now(),
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Misiones: solo ticks si el episodio tiene >=20 min reales.
CREATE OR REPLACE FUNCTION public.on_watch_tick_missions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  hr int;
  min_seconds constant integer := 1200;
BEGIN
  IF NEW.completed = true AND (TG_OP='INSERT' OR COALESCE(OLD.completed,false)=false) THEN
    IF COALESCE(NEW.watch_duration_seconds, 0) < min_seconds THEN
      RETURN NEW;
    END IF;

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
$function$;
