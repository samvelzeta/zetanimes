
-- Table for latino HLS episodes
CREATE TABLE public.latino_episodes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  sources JSONB NOT NULL DEFAULT '{"hls": []}',
  status TEXT NOT NULL DEFAULT 'pending',
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(slug, episode_number)
);

ALTER TABLE public.latino_episodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage latino episodes"
ON public.latino_episodes FOR ALL
USING (public.has_role(auth.uid(), 'owner'));

CREATE POLICY "Anyone can read latino episodes"
ON public.latino_episodes FOR SELECT
USING (true);

CREATE TRIGGER update_latino_episodes_updated_at
BEFORE UPDATE ON public.latino_episodes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for app settings (R2 config etc)
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage settings"
ON public.app_settings FOR ALL
USING (public.has_role(auth.uid(), 'owner'));

CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table for caching resolved slugs
CREATE TABLE public.slug_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anilist_id INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.slug_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read slug cache"
ON public.slug_cache FOR SELECT
USING (true);

CREATE POLICY "Owners can manage slug cache"
ON public.slug_cache FOR ALL
USING (public.has_role(auth.uid(), 'owner'));

-- Insert default R2 settings placeholders
INSERT INTO public.app_settings (key, value, description) VALUES
  ('R2_ACCOUNT_ID', '', 'Cloudflare R2 Account ID'),
  ('R2_ACCESS_KEY', '', 'Cloudflare R2 Access Key'),
  ('R2_SECRET_KEY', '', 'Cloudflare R2 Secret Key'),
  ('R2_BUCKET_NAME', '', 'Cloudflare R2 Bucket Name'),
  ('R2_PUBLIC_URL', '', 'Cloudflare R2 Public URL for streaming');
