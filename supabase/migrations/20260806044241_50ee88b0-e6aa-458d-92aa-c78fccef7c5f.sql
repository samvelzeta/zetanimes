
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
  is_owner boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  _avatar_frame  := COALESCE(_avatar_frame, 'default');
  _name_effect   := COALESCE(_name_effect, 'default');
  _cursor_theme  := COALESCE(_cursor_theme, 'default');
  _banner_preset := COALESCE(_banner_preset, 'aurora');

  -- Owner bypasses all cosmetic validation
  is_owner := public.has_role(uid, 'owner');

  IF NOT is_owner THEN
    -- Validate frame
    IF _avatar_frame <> 'default'
       AND NOT public.user_owns_cosmetic(uid, 'frame', _avatar_frame) THEN
      RAISE EXCEPTION 'frame_not_unlocked: %', _avatar_frame;
    END IF;

    -- Validate name effect
    IF _name_effect <> 'default'
       AND NOT public.user_owns_cosmetic(uid, 'name', _name_effect) THEN
      RAISE EXCEPTION 'name_effect_not_unlocked: %', _name_effect;
    END IF;

    -- Validate banner preset (aurora + sakura-g are free basico)
    IF _banner_preset NOT IN ('aurora', 'sakura-g')
       AND NOT public.user_owns_cosmetic(uid, 'banner', _banner_preset) THEN
      RAISE EXCEPTION 'banner_not_unlocked: %', _banner_preset;
    END IF;
  END IF;

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
