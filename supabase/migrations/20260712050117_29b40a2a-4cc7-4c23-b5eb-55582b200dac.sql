
-- 1) user_xp: remove client UPDATE (writes go through award_xp SECURITY DEFINER)
DROP POLICY IF EXISTS "user_xp self write" ON public.user_xp;

-- 2) user_missions: remove client write (writes go through tick_mission / claim_mission SECURITY DEFINER)
DROP POLICY IF EXISTS "missions self write" ON public.user_missions;

-- 3) user_cosmetics: remove direct client INSERT/UPDATE; route through validated RPC
DROP POLICY IF EXISTS "cosmetics self insert" ON public.user_cosmetics;
DROP POLICY IF EXISTS "cosmetics self update" ON public.user_cosmetics;

-- Helper: check ownership of a cosmetic slug for a pool
CREATE OR REPLACE FUNCTION public.user_owns_cosmetic(_user_id uuid, _pool text, _slug text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_gacha_inventory
    WHERE user_id = _user_id AND pool = _pool AND slug = _slug
  );
$$;

-- Server-side entitlement-checked cosmetics upsert
CREATE OR REPLACE FUNCTION public.equip_cosmetics(
  _avatar_frame text,
  _name_effect text,
  _cursor_theme text,
  _banner_preset text,
  _banner_url text
)
RETURNS public.user_cosmetics
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row_out public.user_cosmetics;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _avatar_frame  := COALESCE(_avatar_frame, 'default');
  _name_effect   := COALESCE(_name_effect, 'default');
  _cursor_theme  := COALESCE(_cursor_theme, 'default');
  _banner_preset := COALESCE(_banner_preset, 'aurora');

  -- Validate frame
  IF _avatar_frame <> 'default'
     AND NOT public.user_owns_cosmetic(uid, 'frame', _avatar_frame) THEN
    RAISE EXCEPTION 'frame_not_unlocked: %', _avatar_frame;
  END IF;

  -- Validate name effect (defaults + z-name/void from special gacha)
  IF _name_effect <> 'default'
     AND NOT public.user_owns_cosmetic(uid, 'name', _name_effect) THEN
    RAISE EXCEPTION 'name_effect_not_unlocked: %', _name_effect;
  END IF;

  -- Validate banner preset (aurora + sakura-g are free basico)
  IF _banner_preset NOT IN ('aurora', 'sakura-g')
     AND NOT public.user_owns_cosmetic(uid, 'banner', _banner_preset) THEN
    RAISE EXCEPTION 'banner_not_unlocked: %', _banner_preset;
  END IF;

  -- cursor_theme: all client-side SVG, no entitlement gate

  INSERT INTO public.user_cosmetics AS uc
    (user_id, avatar_frame, name_effect, cursor_theme, banner_preset, banner_url, updated_at)
  VALUES
    (uid, _avatar_frame, _name_effect, _cursor_theme, _banner_preset, _banner_url, now())
  ON CONFLICT (user_id) DO UPDATE SET
    avatar_frame  = EXCLUDED.avatar_frame,
    name_effect   = EXCLUDED.name_effect,
    cursor_theme  = EXCLUDED.cursor_theme,
    banner_preset = EXCLUDED.banner_preset,
    banner_url    = EXCLUDED.banner_url,
    updated_at    = now()
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_cosmetics(text, text, text, text, text) TO authenticated;
