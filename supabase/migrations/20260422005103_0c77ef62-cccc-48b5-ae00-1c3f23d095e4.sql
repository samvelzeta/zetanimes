-- 1. Tabla de perfiles por cuenta (máx 5 vía trigger)
CREATE TABLE public.account_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  accent_color TEXT,
  font_family TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profiles" ON public.account_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profiles" ON public.account_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profiles" ON public.account_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own profiles" ON public.account_profiles
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_account_profiles_user ON public.account_profiles(user_id);

-- Trigger: máximo 5 perfiles por cuenta
CREATE OR REPLACE FUNCTION public.enforce_max_profiles()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.account_profiles WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Máximo 5 perfiles por cuenta';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_profiles
  BEFORE INSERT ON public.account_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_profiles();

CREATE TRIGGER trg_account_profiles_updated
  BEFORE UPDATE ON public.account_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabla de sesiones de dispositivos
CREATE TABLE public.device_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  user_agent TEXT,
  platform TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_id)
);

ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own devices" ON public.device_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own devices" ON public.device_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own devices" ON public.device_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own devices" ON public.device_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_device_sessions_user ON public.device_sessions(user_id, last_active_at DESC);

-- 3. Configuración por cuenta (PIN global)
CREATE TABLE public.account_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  pin_enabled BOOLEAN NOT NULL DEFAULT false,
  pin_hash TEXT,
  trusted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own settings" ON public.account_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_account_settings_updated
  BEFORE UPDATE ON public.account_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Añadir profile_id a tablas existentes (NULLable = datos previos)
ALTER TABLE public.watch_history ADD COLUMN profile_id UUID;
ALTER TABLE public.anime_lists ADD COLUMN profile_id UUID;

CREATE INDEX idx_watch_history_profile ON public.watch_history(user_id, profile_id);
CREATE INDEX idx_anime_lists_profile ON public.anime_lists(user_id, profile_id);