
-- Bug 1 (crítico): unlock_achievement asignaba ROW_COUNT (integer) a variable boolean.
CREATE OR REPLACE FUNCTION public.unlock_achievement(_user_id uuid, _slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward integer;
  rows_inserted integer := 0;
BEGIN
  SELECT xp_reward INTO reward FROM public.achievements WHERE slug = _slug;
  IF reward IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_achievements (user_id, achievement_slug)
  VALUES (_user_id, _slug)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  IF rows_inserted > 0 THEN
    PERFORM public.award_xp(_user_id, reward);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

-- Bug 2: award_xp hacía 2 escrituras (INSERT + UPDATE de level).
-- Ahora una sola upsert que calcula level y rank inline.
CREATE OR REPLACE FUNCTION public.award_xp(_user_id uuid, _amount integer)
RETURNS public.user_xp
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.user_xp;
  final_xp bigint;
  final_level integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _amount = 0 THEN
    SELECT * INTO row_out FROM public.user_xp WHERE user_id = _user_id;
    RETURN row_out;
  END IF;

  -- Calculamos el nuevo XP a mano para poder derivar level en el mismo statement
  SELECT COALESCE(xp, 0) INTO final_xp FROM public.user_xp WHERE user_id = _user_id;
  final_xp := GREATEST(COALESCE(final_xp, 0) + _amount, 0);
  final_level := public.calc_level_from_xp(final_xp);

  INSERT INTO public.user_xp (user_id, xp, level, rank_slug, updated_at)
  VALUES (_user_id, final_xp, final_level, public.calc_rank_from_level(final_level), now())
  ON CONFLICT (user_id) DO UPDATE
    SET xp = EXCLUDED.xp,
        level = EXCLUDED.level,
        rank_slug = EXCLUDED.rank_slug,
        updated_at = now()
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

-- Índices para ranking público y agregaciones frecuentes
CREATE INDEX IF NOT EXISTS idx_user_xp_xp_desc ON public.user_xp (xp DESC);
CREATE INDEX IF NOT EXISTS idx_profile_stats_user ON public.profile_stats (user_id);
CREATE INDEX IF NOT EXISTS idx_user_missions_completed ON public.user_missions (user_id, completed_at) WHERE completed_at IS NOT NULL;
