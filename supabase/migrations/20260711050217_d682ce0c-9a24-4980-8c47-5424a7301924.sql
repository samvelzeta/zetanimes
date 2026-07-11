CREATE OR REPLACE FUNCTION public.notify_waiting_users_on_video()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anilist_id integer;
  _sample_title text;
  _sample_cover text;
BEGIN
  _anilist_id := NEW.anilist_id;
  IF _anilist_id IS NULL THEN RETURN NEW; END IF;

  SELECT anime_title, anime_cover INTO _sample_title, _sample_cover
    FROM public.anime_lists
    WHERE anime_id = _anilist_id AND list_type = 'waiting'::public.anime_list_type
    LIMIT 1;

  IF _sample_title IS NULL THEN RETURN NEW; END IF;

  -- Notificar a cada usuario en la lista de espera (una vez por usuario)
  INSERT INTO public.notifications (title, message, type, target_user_id, image_url, link, active, created_at)
  SELECT DISTINCT
    '¡Ya disponible!',
    _sample_title || ' ya está disponible. Lo movimos a "Viendo".',
    'anime_available',
    al.user_id,
    _sample_cover,
    '/anime/' || _anilist_id::text,
    true,
    now()
  FROM public.anime_lists al
  WHERE al.anime_id = _anilist_id
    AND al.list_type = 'waiting'::public.anime_list_type;

  -- Borrar duplicados: si el usuario ya tiene 'watching' para este anime, sólo quitar el 'waiting'
  DELETE FROM public.anime_lists a
    USING public.anime_lists b
    WHERE a.anime_id = _anilist_id
      AND a.list_type = 'waiting'::public.anime_list_type
      AND b.anime_id = _anilist_id
      AND b.list_type = 'watching'::public.anime_list_type
      AND a.user_id = b.user_id
      AND COALESCE(a.profile_id::text,'') = COALESCE(b.profile_id::text,'');

  -- Convertir los restantes 'waiting' a 'watching'
  UPDATE public.anime_lists
    SET list_type = 'watching'::public.anime_list_type
    WHERE anime_id = _anilist_id
      AND list_type = 'waiting'::public.anime_list_type;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_waiting_on_video_cache ON public.video_cache;
CREATE TRIGGER trg_notify_waiting_on_video_cache
AFTER INSERT ON public.video_cache
FOR EACH ROW EXECUTE FUNCTION public.notify_waiting_users_on_video();

DROP TRIGGER IF EXISTS trg_notify_waiting_on_video_cache_blocks ON public.video_cache_blocks;
CREATE TRIGGER trg_notify_waiting_on_video_cache_blocks
AFTER INSERT ON public.video_cache_blocks
FOR EACH ROW EXECUTE FUNCTION public.notify_waiting_users_on_video();