ALTER TABLE public.hidden_home_animes
  ADD COLUMN IF NOT EXISTS country_of_origin text,
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_hidden_home_auto_hidden ON public.hidden_home_animes(auto_hidden);
CREATE INDEX IF NOT EXISTS idx_hidden_home_source ON public.hidden_home_animes(source);