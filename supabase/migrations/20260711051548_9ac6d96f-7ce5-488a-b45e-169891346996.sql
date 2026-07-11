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

  -- ── Sorteo especial de títulos secretos ──
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
    UPDATE public.user_gacha_tokens
       SET tokens = tokens - pull_cost, total_spent = total_spent + pull_cost, updated_at = now()
     WHERE user_id = uid;
    INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity)
      VALUES (uid, 'name', chosen_slug, chosen_rarity) ON CONFLICT DO NOTHING;
    INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity)
      VALUES (uid, 'name', chosen_slug, chosen_rarity);
    RETURN jsonb_build_object('ok', true, 'pool', 'name', 'slug', chosen_slug,
      'name', chosen_name, 'image_url', chosen_image, 'rarity', chosen_rarity, 'special', true);
  END IF;

  -- ── Pool normal por probabilidades ──
  r := random();
  chosen_rarity := CASE
    WHEN r < 0.003 THEN 'z'::public.cosmetic_rarity
    WHEN r < 0.020 THEN 'legendario'::public.cosmetic_rarity
    WHEN r < 0.075 THEN 'mitico'::public.cosmetic_rarity
    WHEN r < 0.200 THEN 'raro'::public.cosmetic_rarity
    WHEN r < 0.500 THEN 'especial'::public.cosmetic_rarity
    ELSE                'basico'::public.cosmetic_rarity
  END;

  -- 1) Intentar dentro de la rareza sorteada, priorizando no poseídos
  IF _pool = 'banner' THEN
    SELECT 'admin:'||b.id::text, b.name, b.image_url INTO chosen_slug, chosen_name, chosen_image
    FROM public.admin_banners b
    WHERE b.active = true AND b.rarity = chosen_rarity
      AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
        WHERE i.user_id=uid AND i.pool='banner' AND i.slug='admin:'||b.id::text)
    ORDER BY random() LIMIT 1;
  ELSE
    SELECT 'admin:'||f.id::text, f.name, f.image_url INTO chosen_slug, chosen_name, chosen_image
    FROM public.admin_frames f
    WHERE f.active = true AND f.rarity = chosen_rarity
      AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
        WHERE i.user_id=uid AND i.pool='frame' AND i.slug='admin:'||f.id::text)
    ORDER BY random() LIMIT 1;
  END IF;

  -- 2) Si no hay disponibles no poseídos en esa rareza, probar cualquier rareza no poseída
  IF chosen_slug IS NULL THEN
    IF _pool = 'banner' THEN
      SELECT 'admin:'||b.id::text, b.name, b.image_url, b.rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM public.admin_banners b
      WHERE b.active = true
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
          WHERE i.user_id=uid AND i.pool='banner' AND i.slug='admin:'||b.id::text)
      ORDER BY random() LIMIT 1;
    ELSE
      SELECT 'admin:'||f.id::text, f.name, f.image_url, f.rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM public.admin_frames f
      WHERE f.active = true
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i
          WHERE i.user_id=uid AND i.pool='frame' AND i.slug='admin:'||f.id::text)
      ORDER BY random() LIMIT 1;
    END IF;
  END IF;

  -- 3) Si el usuario ya tiene TODO, entregamos igual una recompensa duplicada de la rareza sorteada
  IF chosen_slug IS NULL THEN
    is_duplicate := true;
    IF _pool = 'banner' THEN
      SELECT 'admin:'||b.id::text, b.name, b.image_url INTO chosen_slug, chosen_name, chosen_image
      FROM public.admin_banners b
      WHERE b.active = true AND b.rarity = chosen_rarity
      ORDER BY random() LIMIT 1;
      IF chosen_slug IS NULL THEN
        SELECT 'admin:'||b.id::text, b.name, b.image_url, b.rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
        FROM public.admin_banners b WHERE b.active = true ORDER BY random() LIMIT 1;
      END IF;
    ELSE
      SELECT 'admin:'||f.id::text, f.name, f.image_url INTO chosen_slug, chosen_name, chosen_image
      FROM public.admin_frames f
      WHERE f.active = true AND f.rarity = chosen_rarity
      ORDER BY random() LIMIT 1;
      IF chosen_slug IS NULL THEN
        SELECT 'admin:'||f.id::text, f.name, f.image_url, f.rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
        FROM public.admin_frames f WHERE f.active = true ORDER BY random() LIMIT 1;
      END IF;
    END IF;
  END IF;

  -- 4) Si de verdad no hay nada activo en el pool
  IF chosen_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'empty_pool');
  END IF;

  UPDATE public.user_gacha_tokens
     SET tokens = tokens - pull_cost, total_spent = total_spent + pull_cost, updated_at = now()
   WHERE user_id = uid;

  INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity)
    VALUES (uid, _pool, chosen_slug, chosen_rarity) ON CONFLICT DO NOTHING;

  INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity)
    VALUES (uid, _pool, chosen_slug, chosen_rarity);

  RETURN jsonb_build_object(
    'ok', true, 'pool', _pool, 'slug', chosen_slug, 'name', chosen_name,
    'image_url', chosen_image, 'rarity', chosen_rarity, 'special', false,
    'duplicate', is_duplicate
  );
END;
$function$;