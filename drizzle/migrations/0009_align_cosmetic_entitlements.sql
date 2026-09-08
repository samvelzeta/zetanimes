CREATE OR REPLACE FUNCTION public.user_owns_cosmetic(_user_id uuid, _pool text, _slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_level integer := 0;
  req_type text;
  req_value integer := 0;
BEGIN
  IF _user_id IS NULL OR _pool IS NULL OR _slug IS NULL THEN
    RETURN false;
  END IF;

  IF public.has_role(_user_id, 'owner'::app_role) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_gacha_inventory
    WHERE user_id = _user_id AND pool = _pool AND slug = _slug
  ) THEN
    RETURN true;
  END IF;

  SELECT COALESCE(level, 0) INTO user_level
  FROM public.user_xp WHERE user_id = _user_id;
  user_level := COALESCE(user_level, 0);

  IF _slug LIKE 'admin:%' AND _pool IN ('frame', 'banner') THEN
    IF _pool = 'frame' THEN
      SELECT requirement_type, requirement_value INTO req_type, req_value
      FROM public.admin_frames
      WHERE id::text = substring(_slug from 7) AND active = true;
    ELSE
      SELECT requirement_type, requirement_value INTO req_type, req_value
      FROM public.admin_banners
      WHERE id::text = substring(_slug from 7) AND active = true;
    END IF;

    RETURN CASE req_type
      WHEN 'free' THEN true
      WHEN 'level' THEN user_level >= COALESCE(req_value, 0)
      WHEN 'premium' THEN public.get_user_plan_slug(_user_id) <> 'free'
      WHEN 'gacha' THEN false
      ELSE false
    END;
  END IF;

  IF _pool = 'frame' THEN
    IF _slug = 'default' THEN RETURN true; END IF;
    IF _slug IN ('neon-orange','sakura','art-petals') THEN RETURN user_level >= 50; END IF;
    IF _slug IN ('hex-neon','shield-fire','art-flames','art-thorns') THEN RETURN user_level >= 70; END IF;
    IF _slug IN ('diamond-ice','art-swords') THEN RETURN user_level >= 90; END IF;
    IF _slug = 'oni' THEN RETURN user_level >= 100; END IF;
    IF _slug IN ('rainbow','art-lotus-red') THEN RETURN user_level >= 120; END IF;
    IF _slug IN ('star-gold','art-roses','art-wings') THEN RETURN public.get_user_plan_slug(_user_id) <> 'free'; END IF;
    RETURN false;
  END IF;

  IF _pool = 'name' THEN
    IF _slug = 'default' THEN RETURN true; END IF;
    IF _slug IN ('shiny','neon') THEN RETURN user_level >= 50; END IF;
    IF _slug IN ('gradient','toxic','gold') THEN RETURN user_level >= 70; END IF;
    IF _slug = 'blood' THEN RETURN user_level >= 90; END IF;
    IF _slug IN ('glitch','rainbow','ink-drip','neon-vein') THEN RETURN user_level >= 120; END IF;
    IF _slug IN ('fire','ice','galaxy') THEN RETURN public.get_user_plan_slug(_user_id) <> 'free'; END IF;
    RETURN false;
  END IF;

  IF _pool = 'cursor' THEN
    IF _slug = 'default' THEN RETURN true; END IF;
    IF _slug IN ('katana','kunai') THEN RETURN user_level >= 50; END IF;
    IF _slug IN ('daga','flecha','hacha') THEN RETURN user_level >= 70; END IF;
    IF _slug = 'star' THEN RETURN user_level >= 120; END IF;
    IF _slug IN ('espada-grande','dragon') THEN RETURN public.get_user_plan_slug(_user_id) <> 'free'; END IF;
    RETURN false;
  END IF;

  IF _pool = 'banner' THEN
    IF _slug = 'aurora' THEN RETURN true; END IF;
    IF _slug = 'sakura-g' THEN RETURN user_level >= 30; END IF;
    IF _slug IN ('cyber','gears') THEN RETURN user_level >= 50; END IF;
    IF _slug = 'lotus' THEN RETURN user_level >= 70; END IF;
    IF _slug IN ('higanbana','ninjas','swamp-far-red') THEN RETURN user_level >= 90; END IF;
    IF _slug IN ('swords','swamp-close-red') THEN RETURN user_level >= 120; END IF;
    IF _slug IN ('sunset','ocean','forest','noir','gold','isekai','magic','roses','swamp-close-blue') THEN RETURN public.get_user_plan_slug(_user_id) <> 'free'; END IF;
    RETURN false;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_cosmetics(_avatar_frame text, _name_effect text, _cursor_theme text, _banner_preset text, _banner_url text)
RETURNS public.user_cosmetics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.user_cosmetics;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  _avatar_frame := COALESCE(_avatar_frame, 'default');
  _name_effect := COALESCE(_name_effect, 'default');
  _cursor_theme := COALESCE(_cursor_theme, 'default');
  _banner_preset := COALESCE(_banner_preset, 'aurora');

  IF NOT public.user_owns_cosmetic(uid, 'frame', _avatar_frame) THEN
    RAISE EXCEPTION 'frame_not_unlocked: %', _avatar_frame;
  END IF;
  IF NOT public.user_owns_cosmetic(uid, 'name', _name_effect) THEN
    RAISE EXCEPTION 'name_effect_not_unlocked: %', _name_effect;
  END IF;
  IF NOT public.user_owns_cosmetic(uid, 'cursor', _cursor_theme) THEN
    RAISE EXCEPTION 'cursor_not_unlocked: %', _cursor_theme;
  END IF;
  IF NOT public.user_owns_cosmetic(uid, 'banner', _banner_preset) THEN
    RAISE EXCEPTION 'banner_not_unlocked: %', _banner_preset;
  END IF;

  INSERT INTO public.user_cosmetics AS uc
    (user_id, avatar_frame, name_effect, cursor_theme, banner_preset, banner_url, updated_at)
  VALUES
    (uid, _avatar_frame, _name_effect, _cursor_theme, _banner_preset, _banner_url, now())
  ON CONFLICT (user_id) DO UPDATE SET
    avatar_frame = EXCLUDED.avatar_frame,
    name_effect = EXCLUDED.name_effect,
    cursor_theme = EXCLUDED.cursor_theme,
    banner_preset = EXCLUDED.banner_preset,
    banner_url = EXCLUDED.banner_url,
    updated_at = now()
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_owns_cosmetic(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equip_cosmetics(text, text, text, text, text) TO authenticated;