CREATE OR REPLACE FUNCTION public.consume_weekly_pending_reserve(_limit integer DEFAULT 12)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer := 0;
  already_released integer := 0;
  remaining integer := 0;
  cycle_key text := to_char(date_trunc('week', now()), 'IYYY-IW');
BEGIN
  _limit := GREATEST(1, LEAST(_limit, 30));

  SELECT count(*)::integer INTO already_released
  FROM public.pending_anime_reserve
  WHERE reserve_state = 'consumed'
    AND consumed_at >= date_trunc('week', now());

  remaining := _limit - already_released;
  IF remaining <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.pending_anime_reserve r
  SET reserve_state = 'consumed',
      consumed_at = now(),
      updated_at = now()
  WHERE r.id IN (
    SELECT pr.id
    FROM public.pending_anime_reserve pr
    JOIN public.approved_animes aa ON aa.anilist_id = pr.anilist_id
    WHERE pr.reserve_state = 'available'
      AND COALESCE(pr.status, '') <> 'RELEASING'
      AND pr.anilist_id IN (SELECT anilist_id FROM public.get_anime_ids_with_seeke_master())
    ORDER BY md5(pr.anilist_id::text || cycle_key), pr.priority DESC, pr.last_seen_at DESC
    LIMIT remaining
  );

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unreleased_reserve_anime_ids()
RETURNS TABLE(anilist_id integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.consume_weekly_pending_reserve(12);

  RETURN QUERY
  SELECT r.anilist_id
  FROM public.pending_anime_reserve r
  WHERE r.reserve_state = 'available'
    AND COALESCE(r.status, '') <> 'RELEASING';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unreleased_reserve_anime_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_weekly_pending_reserve(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unreleased_reserve_anime_ids() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_weekly_pending_reserve(integer) TO anon, authenticated, service_role;