CREATE OR REPLACE FUNCTION public.get_unreleased_reserve_anime_ids()
RETURNS TABLE(anilist_id integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.anilist_id
  FROM public.pending_anime_reserve r
  WHERE r.reserve_state = 'available'
    AND COALESCE(r.status, '') <> 'RELEASING';
$$;

REVOKE EXECUTE ON FUNCTION public.get_unreleased_reserve_anime_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unreleased_reserve_anime_ids() TO anon;
GRANT EXECUTE ON FUNCTION public.get_unreleased_reserve_anime_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unreleased_reserve_anime_ids() TO service_role;