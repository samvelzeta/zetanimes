
CREATE TABLE public.broken_link_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  episode_number INTEGER,
  report_type TEXT NOT NULL DEFAULT 'episode' CHECK (report_type IN ('episode', 'full')),
  anime_title TEXT,
  anime_cover TEXT,
  anilist_id INTEGER,
  report_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fixing', 'resolved')),
  first_reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(slug, episode_number, report_type)
);

ALTER TABLE public.broken_link_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reports"
ON public.broken_link_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Anyone authenticated can insert reports"
ON public.broken_link_reports FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone authenticated can update report count"
ON public.broken_link_reports FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Owners can delete reports"
ON public.broken_link_reports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_broken_link_reports_updated_at
BEFORE UPDATE ON public.broken_link_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
