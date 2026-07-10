
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
BEGIN
  IF NEW.completed = true AND (TG_OP = 'INSERT' OR COALESCE(OLD.completed, false) = false) THEN
    plan_slug := public.get_user_plan_slug(NEW.user_id);
    xp_award := CASE plan_slug
      WHEN 'duo'    THEN 75
      WHEN 'solo'   THEN 60
      WHEN 'basico' THEN 55
      WHEN 'free'   THEN 25
      ELSE 50
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

    IF eps_total > 0 AND (eps_total % 10) = 0 THEN
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
