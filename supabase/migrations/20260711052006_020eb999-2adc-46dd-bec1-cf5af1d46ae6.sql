CREATE OR REPLACE FUNCTION public.gacha_pull(_pool text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cur_tokens int;
  chosen_rarity public.cosmetic_rarity;
  chosen_slug text;
  chosen_name text;
  chosen_image text;
  r numeric;
  special_roll numeric;
  pull_cost int := 2;
  is_special boolean := false;
  has_void boolean;
  has_z_name boolean;
  is_duplicate boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pool NOT IN ('banner','frame') THEN RAISE EXCEPTION 'invalid_pool'; END IF;

  SELECT tokens INTO cur_tokens FROM public.user_gacha_tokens WHERE user_id = uid;
  IF COALESCE(cur_tokens, 0) < pull_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_tokens');
  END IF;

  -- ── Sorteo especial de títulos secretos (name pool) ──
  SELECT EXISTS(SELECT 1 FROM public.user_gacha_inventory WHERE user_id=uid AND pool='name' AND slug='z-name') INTO has_z_name;
  SELECT EXISTS(SELECT 1 FROM public.user_gacha_inventory WHERE user_id=uid AND pool='name' AND slug='void')   INTO has_void;

  special_roll := random();
  IF NOT has_z_name AND special_roll < 0.002 THEN
    chosen_slug := 'z-name'; chosen_name := 'Aura Z'; chosen_image := NULL;
    chosen_rarity := 'z'::public.cosmetic_rarity; is_special := true;
  ELSIF NOT has_void AND special_roll < 0.012 THEN
    chosen_slug := 'void'; chosen_name := 'Vacío'; chosen_image := NULL;
    chosen_rarity := 'legendario'::public.cosmetic_rarity; is_special := true;
  END IF;

  IF is_special THEN
    UPDATE public.user_gacha_tokens SET tokens = tokens - pull_cost, total_spent = total_spent + pull_cost, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity) VALUES (uid, 'name', chosen_slug, chosen_rarity) ON CONFLICT DO NOTHING;
    INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity) VALUES (uid, 'name', chosen_slug, chosen_rarity);
    RETURN jsonb_build_object('ok', true, 'pool', 'name', 'slug', chosen_slug, 'name', chosen_name, 'image_url', chosen_image, 'rarity', chosen_rarity, 'special', true);
  END IF;

  -- ── Catálogo estático (mismo que src/lib/cosmetics.ts) ──
  -- Frames marcados como "gacha": slug | name | rarity
  -- Banners marcados como "gacha": slug | name | rarity
  DROP TABLE IF EXISTS _pool_items;
  CREATE TEMP TABLE _pool_items(slug text, name text, image_url text, rarity public.cosmetic_rarity) ON COMMIT DROP;

  IF _pool = 'frame' THEN
    INSERT INTO _pool_items(slug, name, image_url, rarity) VALUES
      ('art-crown',   'Corona real',       NULL, 'legendario'),
      ('art-dragon',  'Dragón dorado',     NULL, 'legendario'),
      ('art-lotus-blue','Loto azul',       NULL, 'legendario'),
      ('z-demon',     'Portal demoníaco',  NULL, 'z'),
      ('z-cosmic',    'Fénix cósmico',     NULL, 'z'),
      ('z-blood',     'Sangre eterna',     NULL, 'z');
    -- Sumar marcos admin activos
    INSERT INTO _pool_items(slug, name, image_url, rarity)
      SELECT 'admin:'||f.id::text, f.name, f.image_url, f.rarity
      FROM public.admin_frames f WHERE f.active = true;
  ELSE
    INSERT INTO _pool_items(slug, name, image_url, rarity) VALUES
      ('eyes',          'Ojos ancestrales',      NULL, 'z'),
      ('z-abyss',       'El abismo (Z)',         NULL, 'z'),
      ('z-king',        'Rey del trono Z',       NULL, 'z'),
      ('z-void',        'Guardián del vacío',    NULL, 'legendario'),
      ('sakura-trees',  'Cerezos en flor (Z)',   NULL, 'z');
    -- Sumar banners admin activos
    INSERT INTO _pool_items(slug, name, image_url, rarity)
      SELECT 'admin:'||b.id::text, b.name, b.image_url, b.rarity
      FROM public.admin_banners b WHERE b.active = true;
  END IF;

  -- Sorteo de rareza por probabilidades
  r := random();
  chosen_rarity := CASE
    WHEN r < 0.003 THEN 'z'::public.cosmetic_rarity
    WHEN r < 0.020 THEN 'legendario'::public.cosmetic_rarity
    WHEN r < 0.075 THEN 'mitico'::public.cosmetic_rarity
    WHEN r < 0.200 THEN 'raro'::public.cosmetic_rarity
    WHEN r < 0.500 THEN 'especial'::public.cosmetic_rarity
    ELSE                'basico'::public.cosmetic_rarity
  END;

  -- 1) No poseído en la rareza sorteada
  SELECT slug, name, image_url INTO chosen_slug, chosen_name, chosen_image
  FROM _pool_items p
  WHERE p.rarity = chosen_rarity
    AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i WHERE i.user_id=uid AND i.pool=_pool AND i.slug=p.slug)
  ORDER BY random() LIMIT 1;

  -- 2) No poseído en cualquier rareza
  IF chosen_slug IS NULL THEN
    SELECT slug, name, image_url, rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
    FROM _pool_items p
    WHERE NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i WHERE i.user_id=uid AND i.pool=_pool AND i.slug=p.slug)
    ORDER BY random() LIMIT 1;
  END IF;

  -- 3) Duplicado permitido (ya lo tiene todo)
  IF chosen_slug IS NULL THEN
    is_duplicate := true;
    SELECT slug, name, image_url INTO chosen_slug, chosen_name, chosen_image
    FROM _pool_items WHERE rarity = chosen_rarity ORDER BY random() LIMIT 1;
    IF chosen_slug IS NULL THEN
      SELECT slug, name, image_url, rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM _pool_items ORDER BY random() LIMIT 1;
    END IF;
  END IF;

  IF chosen_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_pool');
  END IF;

  UPDATE public.user_gacha_tokens SET tokens = tokens - pull_cost, total_spent = total_spent + pull_cost, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity) VALUES (uid, _pool, chosen_slug, chosen_rarity) ON CONFLICT DO NOTHING;
  INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity) VALUES (uid, _pool, chosen_slug, chosen_rarity);

  RETURN jsonb_build_object(
    'ok', true, 'pool', _pool, 'slug', chosen_slug, 'name', chosen_name,
    'image_url', chosen_image, 'rarity', chosen_rarity, 'special', false,
    'duplicate', is_duplicate
  );
END;
$function$;