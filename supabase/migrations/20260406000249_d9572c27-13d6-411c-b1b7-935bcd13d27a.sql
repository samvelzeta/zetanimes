
DROP POLICY IF EXISTS "Anyone authenticated can insert reports" ON public.broken_link_reports;
DROP POLICY IF EXISTS "Anyone authenticated can update report count" ON public.broken_link_reports;

CREATE POLICY "Authenticated users can insert reports"
ON public.broken_link_reports FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Owners can update reports"
ON public.broken_link_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));
