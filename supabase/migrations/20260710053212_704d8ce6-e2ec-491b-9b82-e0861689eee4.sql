
CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit int DEFAULT 100)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  avatar_url text,
  xp bigint,
  lvl integer,
  rank_slug text,
  avatar_frame text,
  banner_preset text,
  banner_url text,
  name_effect text,
  rank_position bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ux.user_id,
    COALESCE(p.display_name, p.username, 'Usuario'),
    p.avatar_url,
    ux.xp,
    ux.level,
    ux.rank_slug,
    uc.avatar_frame,
    uc.banner_preset,
    uc.banner_url,
    uc.name_effect,
    ROW_NUMBER() OVER (ORDER BY ux.xp DESC, ux.updated_at ASC)
  FROM public.user_xp ux
  JOIN public.profiles p ON p.user_id = ux.user_id
  LEFT JOIN public.user_cosmetics uc ON uc.user_id = ux.user_id
  WHERE NOT public.has_role(ux.user_id, 'owner'::public.app_role)
  ORDER BY ux.xp DESC, ux.updated_at ASC
  LIMIT GREATEST(1, LEAST(_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_rank_position(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*) + 1
  FROM public.user_xp ux2
  WHERE ux2.xp > COALESCE((SELECT xp FROM public.user_xp WHERE user_id = _user_id), 0)
    AND NOT public.has_role(ux2.user_id, 'owner'::public.app_role);
$$;

GRANT EXECUTE ON FUNCTION public.get_user_rank_position(uuid) TO anon, authenticated;
