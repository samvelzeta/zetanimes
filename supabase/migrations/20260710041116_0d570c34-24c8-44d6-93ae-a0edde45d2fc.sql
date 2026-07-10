
-- ============================================================
-- FASE 1: XP + Logros + Cosméticos + Misiones
-- ============================================================

-- ================= user_xp =================
CREATE TABLE public.user_xp (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp bigint NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  rank_slug text NOT NULL DEFAULT 'genin',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_xp TO authenticated;
GRANT ALL ON public.user_xp TO service_role;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_xp public read" ON public.user_xp FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_xp self write" ON public.user_xp FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ================= achievements catalog =================
CREATE TABLE public.achievements (
  slug text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  xp_reward integer NOT NULL DEFAULT 100,
  condition_type text NOT NULL,
  condition_value integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO authenticated, anon;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements public read" ON public.achievements FOR SELECT USING (true);

-- ================= user_achievements =================
CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_slug text NOT NULL REFERENCES public.achievements(slug) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_slug)
);
CREATE INDEX idx_user_achievements_user ON public.user_achievements(user_id);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements public read" ON public.user_achievements FOR SELECT TO authenticated USING (true);

-- ================= user_cosmetics =================
CREATE TABLE public.user_cosmetics (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_frame text NOT NULL DEFAULT 'default',
  name_effect text NOT NULL DEFAULT 'default',
  cursor_theme text NOT NULL DEFAULT 'default',
  banner_preset text NOT NULL DEFAULT 'aurora',
  banner_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_cosmetics TO authenticated;
GRANT INSERT, UPDATE ON public.user_cosmetics TO authenticated;
GRANT ALL ON public.user_cosmetics TO service_role;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cosmetics public read" ON public.user_cosmetics FOR SELECT TO authenticated USING (true);
CREATE POLICY "cosmetics self insert" ON public.user_cosmetics FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cosmetics self update" ON public.user_cosmetics FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- ================= roleplay_missions catalog =================
CREATE TABLE public.roleplay_missions (
  slug text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  type text NOT NULL CHECK (type IN ('daily','weekly')),
  target integer NOT NULL DEFAULT 1,
  xp_reward integer NOT NULL DEFAULT 100,
  icon text NOT NULL DEFAULT 'target',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roleplay_missions TO authenticated;
GRANT ALL ON public.roleplay_missions TO service_role;
ALTER TABLE public.roleplay_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions read" ON public.roleplay_missions FOR SELECT TO authenticated USING (true);

-- ================= user_missions =================
CREATE TABLE public.user_missions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_slug text NOT NULL REFERENCES public.roleplay_missions(slug) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  cycle_started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_slug)
);
CREATE INDEX idx_user_missions_user ON public.user_missions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_missions TO authenticated;
GRANT ALL ON public.user_missions TO service_role;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "missions self read" ON public.user_missions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "missions self write" ON public.user_missions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Helper: calcular nivel + rango a partir de XP
-- Escala:
--   1-10   Genin   (0 - 2500)
--   11-25  Chunin  (2500 - 10000)
--   26-50  Jounin  (10000 - 30000)
--   51-80  ANBU    (30000 - 70000)
--   81-99  Kage    (70000 - 150000)
--   100+   Hokage  (150000+)
-- Fórmula: nivel = floor(sqrt(xp/25)) + 1, capado en 150.
-- ============================================================

CREATE OR REPLACE FUNCTION public.calc_level_from_xp(_xp bigint)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT LEAST(150, GREATEST(1, floor(sqrt(GREATEST(_xp, 0)::numeric / 25))::int + 1));
$$;

CREATE OR REPLACE FUNCTION public.calc_rank_from_level(_level integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _level >= 100 THEN 'hokage'
    WHEN _level >= 81  THEN 'kage'
    WHEN _level >= 51  THEN 'anbu'
    WHEN _level >= 26  THEN 'jounin'
    WHEN _level >= 11  THEN 'chunin'
    ELSE 'genin'
  END;
$$;

-- ============================================================
-- Award XP: suma XP y recalcula nivel/rango. Devuelve fila nueva.
-- ============================================================
CREATE OR REPLACE FUNCTION public.award_xp(_user_id uuid, _amount integer)
RETURNS public.user_xp
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_out public.user_xp;
  new_xp bigint;
  new_level integer;
BEGIN
  IF _user_id IS NULL OR _amount = 0 THEN
    SELECT * INTO row_out FROM public.user_xp WHERE user_id = _user_id;
    RETURN row_out;
  END IF;

  INSERT INTO public.user_xp (user_id, xp, level, rank_slug, updated_at)
  VALUES (_user_id, GREATEST(_amount, 0), 1, 'genin', now())
  ON CONFLICT (user_id) DO UPDATE
    SET xp = GREATEST(public.user_xp.xp + _amount, 0),
        updated_at = now()
  RETURNING xp INTO new_xp;

  new_level := public.calc_level_from_xp(new_xp);

  UPDATE public.user_xp
    SET level = new_level,
        rank_slug = public.calc_rank_from_level(new_level),
        updated_at = now()
    WHERE user_id = _user_id
  RETURNING * INTO row_out;

  RETURN row_out;
END;
$$;

-- ============================================================
-- Unlock achievement: idempotente + award XP asociado.
-- ============================================================
CREATE OR REPLACE FUNCTION public.unlock_achievement(_user_id uuid, _slug text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reward integer;
  inserted boolean := false;
BEGIN
  SELECT xp_reward INTO reward FROM public.achievements WHERE slug = _slug;
  IF reward IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_achievements (user_id, achievement_slug)
  VALUES (_user_id, _slug)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted THEN
    PERFORM public.award_xp(_user_id, reward);
  END IF;
  RETURN inserted;
END;
$$;

-- ============================================================
-- Trigger sobre watch_history: al completar un episodio → 50 XP
-- + check de logros de progreso basados en profile_stats.
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_watch_completed_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  eps_total integer;
BEGIN
  -- Solo cuando pasa a completed = true (INSERT o UPDATE)
  IF NEW.completed = true AND (TG_OP = 'INSERT' OR COALESCE(OLD.completed, false) = false) THEN
    PERFORM public.award_xp(NEW.user_id, 50);

    -- Logros de progreso: leemos el total agregado del usuario
    SELECT COALESCE(SUM(episodes_completed), 0) INTO eps_total
    FROM public.profile_stats WHERE user_id = NEW.user_id;

    IF eps_total >= 1   THEN PERFORM public.unlock_achievement(NEW.user_id, 'first_step'); END IF;
    IF eps_total >= 10  THEN PERFORM public.unlock_achievement(NEW.user_id, 'ten_episodes'); END IF;
    IF eps_total >= 50  THEN PERFORM public.unlock_achievement(NEW.user_id, 'fifty_episodes'); END IF;
    IF eps_total >= 100 THEN PERFORM public.unlock_achievement(NEW.user_id, 'hundred_episodes'); END IF;
    IF eps_total >= 500 THEN PERFORM public.unlock_achievement(NEW.user_id, 'otaku_master'); END IF;

    -- Nocturno: entre 2am y 6am hora del servidor
    IF EXTRACT(hour FROM now() AT TIME ZONE 'UTC') BETWEEN 2 AND 6 THEN
      PERFORM public.unlock_achievement(NEW.user_id, 'night_owl');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_watch_completed_award ON public.watch_history;
CREATE TRIGGER trg_watch_completed_award
AFTER INSERT OR UPDATE OF completed ON public.watch_history
FOR EACH ROW EXECUTE FUNCTION public.on_watch_completed_award();

-- ============================================================
-- Realtime: publicar tablas de progreso
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_xp;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_cosmetics;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_missions;

-- ============================================================
-- SEED: catálogo de logros (20)
-- ============================================================
INSERT INTO public.achievements (slug, name, description, icon, rarity, xp_reward, condition_type, condition_value) VALUES
('first_step',        'Primer paso',        'Completa tu primer episodio',                'baby',        'common',    50,   'episodes',  1),
('ten_episodes',      'Aprendiz',           'Completa 10 episodios',                       'flame',       'common',    150,  'episodes',  10),
('fifty_episodes',    'Fan',                'Completa 50 episodios',                       'star',        'rare',      400,  'episodes',  50),
('hundred_episodes',  'Otaku',              'Completa 100 episodios',                      'trophy',      'epic',      800,  'episodes',  100),
('otaku_master',      'Otaku Legendario',   'Completa 500 episodios',                      'crown',       'legendary', 3000, 'episodes',  500),
('night_owl',         'Nocturno',           'Ve un episodio entre las 2am y 6am',          'moon',        'rare',      250,  'time',      1),
('marathoner',        'Maratonista',        'Ve 5 episodios seguidos en una sesión',       'zap',         'epic',      500,  'session',   5),
('binge_king',        'Rey del binge',      'Ve 10 episodios en un mismo día',             'rocket',      'legendary', 1200, 'day',       10),
('first_list',        'Coleccionista',      'Crea tu primera lista personalizada',         'list',        'common',    100,  'lists',     1),
('ten_lists',         'Bibliotecario',      'Crea 10 listas personalizadas',               'library',     'rare',      400,  'lists',     10),
('shonen_lover',      'Corazón Shonen',     'Ve 20 animes del género shonen',              'sword',       'rare',      350,  'genre',     20),
('slice_soul',        'Alma tranquila',     'Ve 15 animes slice of life',                  'cloud',       'rare',      350,  'genre',     15),
('isekai_traveler',   'Viajero de mundos',  'Ve 10 animes isekai',                         'globe',       'rare',      350,  'genre',     10),
('romance_heart',     'Romántico',          'Ve 15 animes de romance',                     'heart',       'rare',      350,  'genre',     15),
('premium_supporter', 'Apoyo Premium',      'Activa una membresía premium',                'crown',       'epic',      500,  'premium',   1),
('loyal_fan',         'Fan leal',           'Mantén premium activo 30 días',               'medal',       'legendary', 1500, 'premium',   30),
('first_mission',     'En marcha',          'Completa tu primera misión',                  'target',      'common',    100,  'missions',  1),
('mission_hunter',    'Cazador',            'Completa 20 misiones',                        'crosshair',   'rare',      500,  'missions',  20),
('cosmetics_lover',   'Estilo propio',      'Personaliza tu marco de avatar',              'sparkles',    'common',    100,  'cosmetic',  1),
('ambilight_lover',   'Cinéfilo',           'Activa el modo cine (Ambilight)',             'monitor',     'rare',      200,  'cinema',    1);

-- ============================================================
-- SEED: misiones (4 diarias + 4 semanales)
-- ============================================================
INSERT INTO public.roleplay_missions (slug, title, description, type, target, xp_reward, icon) VALUES
('daily_watch_3',      'Sesión diaria',       'Completa 3 episodios hoy',                     'daily',  3,  200, 'play'),
('daily_explore_5',    'Explorador',          'Abre 5 animes nuevos hoy',                     'daily',  5,  150, 'compass'),
('daily_night',        'Guardián nocturno',   'Mira un episodio después de las 10pm',         'daily',  1,  120, 'moon'),
('daily_finish_anime', 'Cierra un ciclo',     'Termina un anime completo hoy',                'daily',  1,  500, 'flag'),
('weekly_watch_20',    'Rutina semanal',      'Completa 20 episodios esta semana',            'weekly', 20, 1000, 'calendar'),
('weekly_marathon',    'Maratón semanal',     'Ve 5 episodios seguidos en una sesión',        'weekly', 5,  600, 'zap'),
('weekly_genres_3',    'Paladar variado',     'Mira animes de 3 géneros diferentes',          'weekly', 3,  500, 'palette'),
('weekly_finish_2',    'Doble cierre',        'Termina 2 animes completos esta semana',       'weekly', 2,  1200,'trophy');
