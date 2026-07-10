
-- ============ ENUM DE RAREZA ============
DO $$ BEGIN
  CREATE TYPE public.cosmetic_rarity AS ENUM ('basico','especial','raro','mitico','legendario','z');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ RAREZA EN BANNERS EXISTENTES ============
ALTER TABLE public.admin_banners
  ADD COLUMN IF NOT EXISTS rarity public.cosmetic_rarity NOT NULL DEFAULT 'basico';

-- ============ ADMIN FRAMES ============
CREATE TABLE IF NOT EXISTS public.admin_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,           -- overlay PNG transparente (opcional)
  shape text NOT NULL DEFAULT 'circle' CHECK (shape IN ('circle','hex','diamond','square','rounded','shield','star')),
  rarity public.cosmetic_rarity NOT NULL DEFAULT 'basico',
  requirement_type text NOT NULL DEFAULT 'free' CHECK (requirement_type IN ('free','level','premium','gacha')),
  requirement_value integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_frames TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_frames TO authenticated;
GRANT ALL ON public.admin_frames TO service_role;

ALTER TABLE public.admin_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read active frames"
  ON public.admin_frames FOR SELECT
  USING (active = true OR public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admins manage frames"
  ON public.admin_frames FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_admin_frames_updated_at
  BEFORE UPDATE ON public.admin_frames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_admin_frames_active_rarity ON public.admin_frames(active, rarity);

-- ============ FICHAS Z ============
CREATE TABLE IF NOT EXISTS public.user_gacha_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tokens integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  last_awarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_gacha_tokens TO authenticated;
GRANT ALL ON public.user_gacha_tokens TO service_role;

ALTER TABLE public.user_gacha_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user read own tokens"
  ON public.user_gacha_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============ INVENTARIO GACHA ============
CREATE TABLE IF NOT EXISTS public.user_gacha_inventory (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool text NOT NULL CHECK (pool IN ('banner','frame','cursor')),
  slug text NOT NULL,
  rarity public.cosmetic_rarity,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, pool, slug)
);

GRANT SELECT ON public.user_gacha_inventory TO authenticated;
GRANT ALL ON public.user_gacha_inventory TO service_role;

ALTER TABLE public.user_gacha_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user read own inventory"
  ON public.user_gacha_inventory FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_gacha_inv_user_pool ON public.user_gacha_inventory(user_id, pool);

-- ============ HISTORIAL DE TIRADAS ============
CREATE TABLE IF NOT EXISTS public.gacha_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pool text NOT NULL,
  reward_slug text NOT NULL,
  reward_rarity public.cosmetic_rarity NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gacha_pulls TO authenticated;
GRANT ALL ON public.gacha_pulls TO service_role;

ALTER TABLE public.gacha_pulls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user read own pulls"
  ON public.gacha_pulls FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_gacha_pulls_user_created ON public.gacha_pulls(user_id, created_at DESC);

-- ============ FUNCIÓN: TIRADA GACHA ============
CREATE OR REPLACE FUNCTION public.gacha_pull(_pool text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cur_tokens int;
  chosen_rarity public.cosmetic_rarity;
  chosen_slug text;
  chosen_name text;
  chosen_image text;
  r numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pool NOT IN ('banner','frame') THEN RAISE EXCEPTION 'invalid_pool'; END IF;

  SELECT tokens INTO cur_tokens FROM public.user_gacha_tokens WHERE user_id = uid;
  IF COALESCE(cur_tokens, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_tokens');
  END IF;

  -- Distribución de probabilidad
  r := random();
  chosen_rarity := CASE
    WHEN r < 0.005 THEN 'z'::public.cosmetic_rarity
    WHEN r < 0.030 THEN 'legendario'::public.cosmetic_rarity
    WHEN r < 0.100 THEN 'mitico'::public.cosmetic_rarity
    WHEN r < 0.250 THEN 'raro'::public.cosmetic_rarity
    WHEN r < 0.550 THEN 'especial'::public.cosmetic_rarity
    ELSE                'basico'::public.cosmetic_rarity
  END;

  -- Buscar item nuevo del pool con esa rareza
  IF _pool = 'banner' THEN
    SELECT 'admin:'||b.id::text, b.name, b.image_url
      INTO chosen_slug, chosen_name, chosen_image
    FROM public.admin_banners b
    WHERE b.active = true AND b.rarity = chosen_rarity
      AND NOT EXISTS (
        SELECT 1 FROM public.user_gacha_inventory i
        WHERE i.user_id = uid AND i.pool='banner' AND i.slug='admin:'||b.id::text
      )
    ORDER BY random() LIMIT 1;
  ELSE
    SELECT 'admin:'||f.id::text, f.name, f.image_url
      INTO chosen_slug, chosen_name, chosen_image
    FROM public.admin_frames f
    WHERE f.active = true AND f.rarity = chosen_rarity
      AND NOT EXISTS (
        SELECT 1 FROM public.user_gacha_inventory i
        WHERE i.user_id = uid AND i.pool='frame' AND i.slug='admin:'||f.id::text
      )
    ORDER BY random() LIMIT 1;
  END IF;

  -- Fallback: cualquier item nuevo del pool
  IF chosen_slug IS NULL THEN
    IF _pool = 'banner' THEN
      SELECT 'admin:'||b.id::text, b.name, b.image_url, b.rarity
        INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM public.admin_banners b
      WHERE b.active = true
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
                        WHERE i.user_id=uid AND i.pool='banner' AND i.slug='admin:'||b.id::text)
      ORDER BY random() LIMIT 1;
    ELSE
      SELECT 'admin:'||f.id::text, f.name, f.image_url, f.rarity
        INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM public.admin_frames f
      WHERE f.active = true
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
                        WHERE i.user_id=uid AND i.pool='frame' AND i.slug='admin:'||f.id::text)
      ORDER BY random() LIMIT 1;
    END IF;
  END IF;

  IF chosen_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'all_owned');
  END IF;

  UPDATE public.user_gacha_tokens
     SET tokens = tokens - 1,
         total_spent = total_spent + 1,
         updated_at = now()
   WHERE user_id = uid;

  INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity)
    VALUES (uid, _pool, chosen_slug, chosen_rarity)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity)
    VALUES (uid, _pool, chosen_slug, chosen_rarity);

  RETURN jsonb_build_object(
    'ok', true,
    'pool', _pool,
    'slug', chosen_slug,
    'name', chosen_name,
    'image_url', chosen_image,
    'rarity', chosen_rarity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gacha_pull(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gacha_pull(text) TO authenticated;

-- ============ TRIGGER: FICHAS AL COMPLETAR EPISODIOS ============
CREATE OR REPLACE FUNCTION public.on_watch_completed_award()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  eps_total integer;
BEGIN
  IF NEW.completed = true AND (TG_OP = 'INSERT' OR COALESCE(OLD.completed, false) = false) THEN
    PERFORM public.award_xp(NEW.user_id, 50);

    SELECT COALESCE(SUM(episodes_completed), 0) INTO eps_total
    FROM public.profile_stats WHERE user_id = NEW.user_id;

    IF eps_total >= 1   THEN PERFORM public.unlock_achievement(NEW.user_id, 'first_step'); END IF;
    IF eps_total >= 10  THEN PERFORM public.unlock_achievement(NEW.user_id, 'ten_episodes'); END IF;
    IF eps_total >= 50  THEN PERFORM public.unlock_achievement(NEW.user_id, 'fifty_episodes'); END IF;
    IF eps_total >= 100 THEN PERFORM public.unlock_achievement(NEW.user_id, 'hundred_episodes'); END IF;
    IF eps_total >= 500 THEN PERFORM public.unlock_achievement(NEW.user_id, 'otaku_master'); END IF;

    IF EXTRACT(hour FROM now() AT TIME ZONE 'UTC') BETWEEN 2 AND 6 THEN
      PERFORM public.unlock_achievement(NEW.user_id, 'night_owl');
    END IF;

    -- Ficha Z cada 10 episodios completados totales
    IF eps_total > 0 AND (eps_total % 10) = 0 THEN
      INSERT INTO public.user_gacha_tokens (user_id, tokens, total_earned, last_awarded_at, updated_at)
      VALUES (NEW.user_id, 1, 1, now(), now())
      ON CONFLICT (user_id) DO UPDATE SET
        tokens = public.user_gacha_tokens.tokens + 1,
        total_earned = public.user_gacha_tokens.total_earned + 1,
        last_awarded_at = now(),
        updated_at = now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
