DROP POLICY IF EXISTS "Authenticated users can insert reports" ON public.broken_link_reports;

CREATE POLICY "Authenticated users can insert reports"
ON public.broken_link_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);