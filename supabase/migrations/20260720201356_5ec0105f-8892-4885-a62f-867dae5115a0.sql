CREATE OR REPLACE FUNCTION public.get_pending_reserve_admin_stats()
RETURNS TABLE(total bigint, available bigint, consumed bigint, approved bigint, hidden_active bigint, seeke_master bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.pending_anime_reserve)::bigint AS total,
    (SELECT count(*) FROM public.pending_anime_reserve WHERE reserve_state = 'available')::bigint AS available,
    (SELECT count(*) FROM public.pending_anime_reserve WHERE reserve_state = 'consumed')::bigint AS consumed,
    (SELECT count(*) FROM public.approved_animes)::bigint AS approved,
    (SELECT count(*) FROM public.hidden_pending_animes WHERE expires_at > now())::bigint AS hidden_active,
    (SELECT count(DISTINCT anilist_id) FROM public.get_anime_ids_with_seeke_master())::bigint AS seeke_master;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pending_reserve_admin_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pending_reserve_admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_pending_reserve_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_reserve_admin_stats() TO service_role;