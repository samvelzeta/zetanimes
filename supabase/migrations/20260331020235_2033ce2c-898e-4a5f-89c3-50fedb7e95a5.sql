
CREATE TABLE public.anime_download_tracker (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anilist_id integer NOT NULL,
  title text NOT NULL,
  cover_image text,
  total_episodes integer DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'downloading', 'completed')),
  airing_status text,
  genres text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.anime_episode_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracker_id uuid REFERENCES public.anime_download_tracker(id) ON DELETE CASCADE NOT NULL,
  episode_number integer NOT NULL,
  downloaded boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(tracker_id, episode_number)
);

ALTER TABLE public.anime_download_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anime_episode_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage download tracker" ON public.anime_download_tracker FOR ALL USING (has_role(auth.uid(), 'owner'::app_role));
CREATE POLICY "Owners can manage episode downloads" ON public.anime_episode_downloads FOR ALL USING (has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER update_download_tracker_updated_at BEFORE UPDATE ON public.anime_download_tracker FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
