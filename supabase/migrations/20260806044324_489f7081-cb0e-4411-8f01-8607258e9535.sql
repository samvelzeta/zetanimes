
CREATE OR REPLACE FUNCTION public.user_owns_cosmetic(_user_id uuid, _pool text, _slug text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_level integer;
  user_plan text;
  req_type text;
  req_value integer;
BEGIN
  -- Check gacha inventory first
  IF EXISTS (
    SELECT 1 FROM public.user_gacha_inventory
    WHERE user_id = _user_id AND pool = _pool AND slug = _slug
  ) THEN
    RETURN true;
  END IF;

  -- Check admin-uploaded cosmetics (admin_frames / admin_banners)
  IF _slug LIKE 'admin:%' THEN
    DECLARE
      admin_id text := substring(_slug from 7);
    BEGIN
      IF _pool = 'frame' THEN
        SELECT af.requirement_type, af.requirement_value INTO req_type, req_value
        FROM public.admin_frames af WHERE af.id::text = admin_id AND af.active = true;
      ELSIF _pool = 'banner' THEN
        SELECT ab.requirement_type, ab.requirement_value INTO req_type, req_value
        FROM public.admin_banners ab WHERE ab.id::text = admin_id AND ab.active = true;
      END IF;

      IF req_type IS NULL THEN RETURN false; END IF;
      IF req_type = 'free' THEN RETURN true; END IF;
      IF req_type = 'premium' THEN
        RETURN EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = _user_id AND p.subscription_status IN ('active', 'trusted')
        );
      END IF;
      IF req_type = 'level' THEN
        SELECT ux.level INTO user_level FROM public.user_xp ux WHERE ux.user_id = _user_id;
        RETURN COALESCE(user_level, 0) >= COALESCE(req_value, 0);
      END IF;
      -- gacha requirement but not in inventory
      RETURN false;
    END;
  END IF;

  -- Built-in cosmetics: check by known slugs with level/premium requirements
  -- Frames
  IF _pool = 'frame' THEN
    IF _slug IN ('neon-orange','sakura','art-petals') THEN
      SELECT ux.level INTO user_level FROM public.user_xp ux WHERE ux.user_id = _user_id;
      RETURN COALESCE(user_level, 0) >= 50;
    END IF;
    IF _slug IN ('hex-neon','shield-fire','art-flames','art-thorns') THEN
      SELECT ux.level INTO user_level FROM public.user_xp ux WHERE ux.user_id = _user_id;
      RETURN COALESCE(user_level, 0) >= 70;
    END IF;
    IF _slug IN ('diamond-ice','art-swords') THEN
      SELECT ux.level INTO user_level FROM public.user_xp ux WHERE ux.user_id = _user_id;
      RETURN COALESCE(user_level, 0) >= 90;
    END IF;
    IF _slug IN ('rainbow','art-lotus-red') THEN
      SELECT ux.level INTO user_level FROM public.user_xp ux WHERE ux.user_id = _user_id;
      RETURN COALESCE(user_level, 0) >= 120;
    END IF;
    IF _slug IN ('star-gold','art-roses','art-wings') THEN
      RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = _user_id AND p.subscription_status IN ('active', 'trusted')
      );
    END IF;
  END IF;

  -- Banners: built-in free ones handled in equip_cosmetics (aurora, sakura-g)
  -- Level/premium banners
  IF _pool = 'banner' THEN
    -- Add built-in banner checks here if needed
    NULL;
  END IF;

  RETURN false;
END;
$$;
