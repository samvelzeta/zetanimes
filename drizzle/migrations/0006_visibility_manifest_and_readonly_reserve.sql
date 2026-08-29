-- 1) La lectura pública ya NO escribe en la base (antes cada visitante disparaba UPDATEs)
CREATE OR REPLACE FUNCTION public.get_unreleased_reserve_anime_ids()
 RETURNS TABLE(anilist_id integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT r.anilist_id
  FROM public.pending_anime_reserve r
  WHERE r.reserve_state = 'available'
    AND COALESCE(r.status, '') <> 'RELEASING';
$function$;

-- Consumo semanal explícito (admin / cron), ya no en la ruta de lectura
CREATE OR REPLACE FUNCTION public.run_weekly_pending_reserve_consumption(_limit integer DEFAULT 12)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  RETURN public.consume_weekly_pending_reserve(_limit);
END;
$function$;

-- 2) Manifiesto único de visibilidad: una sola consulta en lugar de 5-6 por página
CREATE OR REPLACE FUNCTION public.get_visibility_manifest()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'v', 1,
    'generated_at', now(),
    'approved', COALESCE((SELECT jsonb_agg(a.anilist_id) FROM public.approved_animes a), '[]'::jsonb),
    'hidden', COALESCE((SELECT jsonb_agg(h.anilist_id) FROM public.hidden_home_animes h WHERE h.is_hidden = true), '[]'::jsonb),
    'adult', COALESCE((SELECT jsonb_agg(ad.anilist_id) FROM public.adult_animes ad), '[]'::jsonb),
    'seeke', COALESCE((SELECT jsonb_agg(s.anilist_id) FROM public.get_anime_ids_with_seeke_master() s), '[]'::jsonb),
    'reserve', COALESCE((SELECT jsonb_agg(r.anilist_id) FROM public.pending_anime_reserve r
                          WHERE r.reserve_state = 'available' AND COALESCE(r.status,'') <> 'RELEASING'), '[]'::jsonb),
    'status_overrides', COALESCE((SELECT jsonb_object_agg(o.anilist_id::text, o.manual_status) FROM public.anime_status_overrides o), '{}'::jsonb),
    'dubbed', COALESCE((SELECT jsonb_agg(DISTINCT d.anilist_id) FROM public.list_dubbed_anime_ids() d WHERE d.anilist_id IS NOT NULL), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.get_visibility_manifest() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_visibility_manifest() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_weekly_pending_reserve_consumption(integer) TO authenticated, service_role;