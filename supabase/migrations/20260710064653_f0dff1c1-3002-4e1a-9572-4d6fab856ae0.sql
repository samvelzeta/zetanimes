
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
    -- Reducción del 40% respecto a los valores originales
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

    -- Ficha Z cada 20 episodios (antes cada 10) para encarecer el gacha
    IF eps_total > 0 AND (eps_total % 20) = 0 THEN
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

CREATE OR REPLACE FUNCTION public.gacha_pull(_pool text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cur_tokens int;
  chosen_rarity public.cosmetic_rarity;
  chosen_slug text;
  chosen_name text;
  chosen_image text;
  r numeric;
  pull_cost int := 2;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pool NOT IN ('banner','frame') THEN RAISE EXCEPTION 'invalid_pool'; END IF;

  SELECT tokens INTO cur_tokens FROM public.user_gacha_tokens WHERE user_id = uid;
  IF COALESCE(cur_tokens, 0) < pull_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_tokens');
  END IF;

  r := random();
  chosen_rarity := CASE
    WHEN r < 0.003 THEN 'z'::public.cosmetic_rarity
    WHEN r < 0.020 THEN 'legendario'::public.cosmetic_rarity
    WHEN r < 0.075 THEN 'mitico'::public.cosmetic_rarity
    WHEN r < 0.200 THEN 'raro'::public.cosmetic_rarity
    WHEN r < 0.500 THEN 'especial'::public.cosmetic_rarity
    ELSE                'basico'::public.cosmetic_rarity
  END;

  IF _pool = 'banner' THEN
    SELECT 'admin:'||b.id::text, b.name, b.image_url
      INTO chosen_slug, chosen_name, chosen_image
    FROM public.admin_banners b
    WHERE b.active = true AND b.rarity = chosen_rarity
      AND NOT EXISTS (
        SELECT 1 FROM public.user_gacha_inventory i
        WHERE i.user_id = uid AND i.pool='banner' AND i.slug='admin:'||b.id::text
      )
    ORDER BY random() LIMIT 1;
  ELSE
    SELECT 'admin:'||f.id::text, f.name, f.image_url
      INTO chosen_slug, chosen_name, chosen_image
    FROM public.admin_frames f
    WHERE f.active = true AND f.rarity = chosen_rarity
      AND NOT EXISTS (
        SELECT 1 FROM public.user_gacha_inventory i
        WHERE i.user_id = uid AND i.pool='frame' AND i.slug='admin:'||f.id::text
      )
    ORDER BY random() LIMIT 1;
  END IF;

  IF chosen_slug IS NULL THEN
    IF _pool = 'banner' THEN
      SELECT 'admin:'||b.id::text, b.name, b.image_url, b.rarity
        INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM public.admin_banners b
      WHERE b.active = true
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
                        WHERE i.user_id=uid AND i.pool='banner' AND i.slug='admin:'||b.id::text)
      ORDER BY random() LIMIT 1;
    ELSE
      SELECT 'admin:'||f.id::text, f.name, f.image_url, f.rarity
        INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM public.admin_frames f
      WHERE f.active = true
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
                        WHERE i.user_id=uid AND i.pool='frame' AND i.slug='admin:'||f.id::text)
      ORDER BY random() LIMIT 1;
    END IF;
  END IF;

  IF chosen_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'all_owned');
  END IF;

  UPDATE public.user_gacha_tokens
     SET tokens = tokens - pull_cost,
         total_spent = total_spent + pull_cost,
         updated_at = now()
   WHERE user_id = uid;

  INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity)
    VALUES (uid, _pool, chosen_slug, chosen_rarity)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity)
    VALUES (uid, _pool, chosen_slug, chosen_rarity);

  RETURN jsonb_build_object(
    'ok', true,
    'pool', _pool,
    'slug', chosen_slug,
    'name', chosen_name,
    'image_url', chosen_image,
    'rarity', chosen_rarity
  );
END;
$function$;
