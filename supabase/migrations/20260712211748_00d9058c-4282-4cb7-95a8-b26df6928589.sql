
-- 1) Function to submit/update a broken link report atomically without exposing other reports
CREATE OR REPLACE FUNCTION public.submit_broken_link_report(
  _slug text,
  _episode_number integer,
  _report_type text,
  _anime_title text,
  _anime_cover text,
  _anilist_id integer,
  _reason text,
  _plan_slug text,
  _priority_label text,
  _priority_score integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing_id uuid;
  existing_count int;
  existing_priority int;
  report_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT id, report_count, COALESCE(priority_score, 0)
    INTO existing_id, existing_count, existing_priority
  FROM public.broken_link_reports
  WHERE slug = _slug
    AND report_type = _report_type
    AND ((_episode_number IS NULL AND episode_number IS NULL) OR episode_number = _episode_number)
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.broken_link_reporters
      WHERE report_id = existing_id AND user_id = uid
    ) THEN
      UPDATE public.broken_link_reports
        SET report_count = existing_count + 1,
            last_reported_at = now(),
            reason = _reason,
            status = 'pending',
            priority_score = GREATEST(existing_priority, COALESCE(_priority_score, 0)),
            highest_plan_slug = CASE
              WHEN COALESCE(_priority_score, 0) >= existing_priority THEN _plan_slug
              ELSE highest_plan_slug END,
            highest_priority_label = CASE
              WHEN COALESCE(_priority_score, 0) >= existing_priority THEN _priority_label
              ELSE highest_priority_label END
        WHERE id = existing_id;
    END IF;
    report_id := existing_id;
  ELSE
    INSERT INTO public.broken_link_reports
      (slug, episode_number, report_type, anime_title, anime_cover, anilist_id,
       reason, highest_plan_slug, highest_priority_label, priority_score)
    VALUES
      (_slug, _episode_number, _report_type, _anime_title, _anime_cover, _anilist_id,
       _reason, _plan_slug, _priority_label, COALESCE(_priority_score, 0))
    RETURNING id INTO report_id;
  END IF;

  INSERT INTO public.broken_link_reporters
    (report_id, user_id, plan_slug, priority_label, priority_score)
  VALUES
    (report_id, uid, _plan_slug, _priority_label, COALESCE(_priority_score, 0))
  ON CONFLICT DO NOTHING;

  RETURN report_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_broken_link_report(text, integer, text, text, text, integer, text, text, text, integer) TO authenticated;

-- 2) Restrict SELECT on broken_link_reports
DROP POLICY IF EXISTS "Anyone authenticated can view reports" ON public.broken_link_reports;

CREATE POLICY "Reports visible to admins, owners, or original reporter"
ON public.broken_link_reports
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'owner'::public.app_role)
  OR EXISTS (
    SELECT 1 FROM public.broken_link_reporters r
    WHERE r.report_id = broken_link_reports.id
      AND r.user_id = auth.uid()
  )
);
