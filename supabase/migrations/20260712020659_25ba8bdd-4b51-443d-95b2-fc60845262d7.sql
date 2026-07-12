CREATE OR REPLACE FUNCTION public.prevent_delete_seeke_master_video()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.episode = 0 OR COALESCE(jsonb_array_length(OLD.sources -> 'seeke'), 0) > 0 THEN
    RAISE EXCEPTION 'Protected Seeke master links cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_seeke_master_video ON public.video_cache;
CREATE TRIGGER trg_prevent_delete_seeke_master_video
BEFORE DELETE ON public.video_cache
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_seeke_master_video();

CREATE OR REPLACE FUNCTION public.prevent_delete_video_cache_blocks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Protected Seeke block master links cannot be deleted';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_video_cache_blocks ON public.video_cache_blocks;
CREATE TRIGGER trg_prevent_delete_video_cache_blocks
BEFORE DELETE ON public.video_cache_blocks
FOR EACH ROW
EXECUTE FUNCTION public.prevent_delete_video_cache_blocks();