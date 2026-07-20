CREATE TABLE public.pending_anime_reserve (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id integer NOT NULL UNIQUE,
  title text NOT NULL,
  romaji_title text,
  english_title text,
  cover_image text,
  status text,
  format text,
  episodes integer,
  average_score integer,
  source text NOT NULL DEFAULT 'manual',
  priority integer NOT NULL DEFAULT 0,
  reserve_state text NOT NULL DEFAULT 'available',
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  consumed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_anime_reserve TO authenticated;
GRANT ALL ON public.pending_anime_reserve TO service_role;

ALTER TABLE public.pending_anime_reserve ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pending reserve"
ON public.pending_anime_reserve
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can insert pending reserve"
ON public.pending_anime_reserve
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can update pending reserve"
ON public.pending_anime_reserve
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE POLICY "Admins can delete pending reserve"
ON public.pending_anime_reserve
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_pending_anime_reserve_updated_at
BEFORE UPDATE ON public.pending_anime_reserve
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pending_anime_reserve_state_priority
ON public.pending_anime_reserve (reserve_state, priority DESC, last_seen_at DESC);

CREATE INDEX idx_pending_anime_reserve_status
ON public.pending_anime_reserve (status);

CREATE OR REPLACE FUNCTION public.get_pending_reserve_admin_stats()
RETURNS TABLE(total bigint, available bigint, consumed bigint, approved bigint, hidden_active bigint, seeke_master bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.pending_anime_reserve)::bigint AS total,
    (SELECT count(*) FROM public.pending_anime_reserve WHERE reserve_state = 'available')::bigint AS available,
    (SELECT count(*) FROM public.pending_anime_reserve WHERE reserve_state = 'consumed')::bigint AS consumed,
    (SELECT count(*) FROM public.approved_animes)::bigint AS approved,
    (SELECT count(*) FROM public.hidden_pending_animes WHERE expires_at > now())::bigint AS hidden_active,
    (SELECT count(DISTINCT anilist_id) FROM public.get_anime_ids_with_seeke_master())::bigint AS seeke_master;
$$;