CREATE OR REPLACE FUNCTION public.trim_watch_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.watch_history wh
  USING (
    SELECT id, row_number() OVER (ORDER BY created_at DESC) AS rn
    FROM public.watch_history
    WHERE user_id = NEW.user_id
      AND coalesce(profile_id::text, 'default') = coalesce(NEW.profile_id::text, 'default')
  ) r
  WHERE wh.id = r.id AND r.rn > 10;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trim_watch_history_trg ON public.watch_history;
CREATE TRIGGER trim_watch_history_trg
AFTER INSERT ON public.watch_history
FOR EACH ROW EXECUTE FUNCTION public.trim_watch_history();