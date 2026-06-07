ALTER TABLE public.hidden_home_animes
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_hidden_home_is_hidden ON public.hidden_home_animes(is_hidden);