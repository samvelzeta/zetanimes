
-- Pity tracking table
CREATE TABLE IF NOT EXISTS public.gacha_pity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pulls_since_legendary int NOT NULL DEFAULT 0,
  pulls_since_special int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.gacha_pity TO authenticated;
GRANT ALL ON public.gacha_pity TO service_role;
ALTER TABLE public.gacha_pity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own pity" ON public.gacha_pity FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Service role all pity" ON public.gacha_pity FOR ALL TO service_role USING (true);

-- Rewrite gacha_pull with scarcity
CREATE OR REPLACE FUNCTION public.gacha_pull(_pool text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cur_tokens int;
  chosen_rarity public.cosmetic_rarity;
  chosen_slug text; chosen_name text; chosen_image text;
  r numeric; special_roll numeric;
  pull_cost int := 2;
  is_special boolean := false;
  has_void boolean; has_z_name boolean;
  is_duplicate boolean := false;
  rarity_order text[] := ARRAY['z','legendario','mitico','raro','especial','basico'];
  idx int;
  pity_legendary int := 0;
  pity_special int := 0;
  pity_forced boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pool NOT IN ('banner','frame') THEN RAISE EXCEPTION 'invalid_pool'; END IF;

  SELECT tokens INTO cur_tokens FROM public.user_gacha_tokens WHERE user_id = uid;
  IF COALESCE(cur_tokens, 0) < pull_cost THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_tokens');
  END IF;

  -- Load pity counters
  INSERT INTO public.gacha_pity(user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  SELECT pulls_since_legendary, pulls_since_special INTO pity_legendary, pity_special
    FROM public.gacha_pity WHERE user_id = uid;

  -- Special name items (ultra rare: 0.05% and 0.3%)
  SELECT EXISTS(SELECT 1 FROM public.user_gacha_inventory WHERE user_id=uid AND pool='name' AND slug='z-name') INTO has_z_name;
  SELECT EXISTS(SELECT 1 FROM public.user_gacha_inventory WHERE user_id=uid AND pool='name' AND slug='void') INTO has_void;
  special_roll := random();
  IF NOT has_z_name AND special_roll < 0.0005 THEN
    chosen_slug := 'z-name'; chosen_name := 'Aura Z'; chosen_image := NULL;
    chosen_rarity := 'z'::public.cosmetic_rarity; is_special := true;
  ELSIF NOT has_void AND special_roll < 0.0035 THEN
    chosen_slug := 'void'; chosen_name := 'Vacío'; chosen_image := NULL;
    chosen_rarity := 'legendario'::public.cosmetic_rarity; is_special := true;
  END IF;

  IF is_special THEN
    UPDATE public.user_gacha_tokens SET tokens = tokens - pull_cost, total_spent = total_spent + pull_cost, updated_at = now() WHERE user_id = uid;
    INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity) VALUES (uid, 'name', chosen_slug, chosen_rarity) ON CONFLICT DO NOTHING;
    INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity) VALUES (uid, 'name', chosen_slug, chosen_rarity);
    -- Reset pity on legendary+
    UPDATE public.gacha_pity SET pulls_since_legendary = 0, pulls_since_special = 0, updated_at = now() WHERE user_id = uid;
    RETURN jsonb_build_object('ok', true, 'pool', 'name', 'slug', chosen_slug, 'name', chosen_name, 'image_url', chosen_image, 'rarity', chosen_rarity, 'special', true);
  END IF;

  -- Build pool items
  DROP TABLE IF EXISTS _pool_items;
  CREATE TEMP TABLE _pool_items(slug text, name text, image_url text, rarity public.cosmetic_rarity) ON COMMIT DROP;
  IF _pool = 'frame' THEN
    INSERT INTO _pool_items(slug, name, image_url, rarity) VALUES
      ('neon-orange','Neón Zet',NULL,'especial'),('sakura','Sakura',NULL,'especial'),('art-petals','Pétalos de sakura',NULL,'especial'),
      ('hex-neon','Hexágono neón',NULL,'raro'),('shield-fire','Escudo llameante',NULL,'raro'),('art-flames','Aro de fuego azul',NULL,'raro'),('art-thorns','Espinas malditas',NULL,'raro'),
      ('diamond-ice','Diamante de hielo',NULL,'mitico'),('star-gold','Estrella dorada',NULL,'mitico'),('art-swords','Espadas cruzadas',NULL,'mitico'),('art-roses','Rosas y espinas',NULL,'mitico'),
      ('rainbow','Arcoíris',NULL,'legendario'),('art-wings','Alas celestiales',NULL,'legendario'),('art-crown','Corona real',NULL,'legendario'),('art-dragon','Dragón dorado',NULL,'legendario'),('art-lotus-red','Loto rojo',NULL,'legendario'),('art-lotus-blue','Loto azul',NULL,'legendario'),('viking','Casco de Odín',NULL,'legendario'),('twin-blades','Espadas gemelas',NULL,'legendario'),
      ('z-demon','Portal demoníaco',NULL,'z'),('z-cosmic','Fénix cósmico',NULL,'z'),('z-blood','Sangre eterna',NULL,'z'),('z-skull-hands','Guardianes óseos',NULL,'z');
    INSERT INTO _pool_items(slug, name, image_url, rarity)
      SELECT 'admin:'||f.id::text, f.name, f.image_url, f.rarity FROM public.admin_frames f WHERE f.active = true;
  ELSE
    INSERT INTO _pool_items(slug, name, image_url, rarity) VALUES
      ('aurora','Aurora',NULL,'basico'),('sakura-g','Sakura',NULL,'basico'),
      ('cyber','Cyber city',NULL,'especial'),('sunset','Atardecer',NULL,'especial'),('noir','Noir',NULL,'especial'),
      ('ocean','Océano',NULL,'raro'),('forest','Bosque místico',NULL,'raro'),('lotus','Loto',NULL,'raro'),
      ('gold','Dorado',NULL,'mitico'),('higanbana','Higanbana (muerte)',NULL,'mitico'),('ninjas','Ninjas nocturnos',NULL,'mitico'),('roses','Rosas de sangre',NULL,'mitico'),('swamp-far-red','Pantano lejano',NULL,'mitico'),
      ('swords','Espadas caídas',NULL,'legendario'),('isekai','Isekai',NULL,'legendario'),('magic','Magia elemental',NULL,'legendario'),('z-void','Guardián del vacío',NULL,'legendario'),('swamp-close-red','Loto rojo en el lodo',NULL,'legendario'),('swamp-close-blue','Loto azul lunar',NULL,'legendario'),('moorland','Páramo desolado',NULL,'legendario'),
      ('eyes','Ojos ancestrales',NULL,'z'),('z-abyss','El abismo (Z)',NULL,'z'),('z-king','Rey del trono Z',NULL,'z'),('sakura-trees','Cerezos en flor (Z)',NULL,'z');
    INSERT INTO _pool_items(slug, name, image_url, rarity)
      SELECT 'admin:'||b.id::text, b.name, b.image_url, b.rarity FROM public.admin_banners b WHERE b.active = true;
  END IF;

  -- HARD PITY: guarantee legendario after 90 pulls
  IF pity_legendary >= 90 THEN
    chosen_rarity := 'legendario'::public.cosmetic_rarity;
    pity_forced := true;
  -- SOFT PITY: increased rates starting at pull 75
  ELSIF pity_legendary >= 75 THEN
    r := random();
    -- Linearly boost legendary chance from 0.45% to ~15% between pulls 75-90
    IF r < (0.0045 + (pity_legendary - 75) * 0.01) THEN
      chosen_rarity := 'legendario'::public.cosmetic_rarity;
      pity_forced := true;
    END IF;
  END IF;

  -- Normal roll if not forced by pity
  IF NOT pity_forced THEN
    r := random();
    -- MUCH harder rates: basico 70%, especial 20%, raro 7%, mitico 2.5%, legendario 0.45%, z 0.05%
    chosen_rarity := CASE
      WHEN r < 0.0005 THEN 'z'::public.cosmetic_rarity
      WHEN r < 0.005  THEN 'legendario'::public.cosmetic_rarity
      WHEN r < 0.030  THEN 'mitico'::public.cosmetic_rarity
      WHEN r < 0.100  THEN 'raro'::public.cosmetic_rarity
      WHEN r < 0.300  THEN 'especial'::public.cosmetic_rarity
      ELSE 'basico'::public.cosmetic_rarity
    END;
  END IF;

  -- Select item from chosen rarity (avoid duplicates)
  SELECT slug, name, image_url INTO chosen_slug, chosen_name, chosen_image
  FROM _pool_items p WHERE p.rarity = chosen_rarity
    AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i WHERE i.user_id=uid AND i.pool=_pool AND i.slug=p.slug)
  ORDER BY random() LIMIT 1;

  -- Fallback to lower rarity if pool exhausted
  IF chosen_slug IS NULL THEN
    idx := array_position(rarity_order, chosen_rarity::text);
    WHILE chosen_slug IS NULL AND idx < array_length(rarity_order, 1) LOOP
      idx := idx + 1;
      SELECT slug, name, image_url, rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity
      FROM _pool_items p WHERE p.rarity = rarity_order[idx]::public.cosmetic_rarity
        AND NOT EXISTS (SELECT 1 FROM public.user_gacha_inventory i WHERE i.user_id=uid AND i.pool=_pool AND i.slug=p.slug)
      ORDER BY random() LIMIT 1;
    END LOOP;
  END IF;

  -- All items owned: duplicate
  IF chosen_slug IS NULL THEN
    is_duplicate := true;
    SELECT slug, name, image_url INTO chosen_slug, chosen_name, chosen_image FROM _pool_items WHERE rarity = chosen_rarity ORDER BY random() LIMIT 1;
    IF chosen_slug IS NULL THEN
      SELECT slug, name, image_url, rarity INTO chosen_slug, chosen_name, chosen_image, chosen_rarity FROM _pool_items ORDER BY random() LIMIT 1;
    END IF;
  END IF;

  IF chosen_slug IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'empty_pool'); END IF;

  -- Deduct tokens and record
  UPDATE public.user_gacha_tokens SET tokens = tokens - pull_cost, total_spent = total_spent + pull_cost, updated_at = now() WHERE user_id = uid;
  INSERT INTO public.user_gacha_inventory(user_id, pool, slug, rarity) VALUES (uid, _pool, chosen_slug, chosen_rarity) ON CONFLICT DO NOTHING;
  INSERT INTO public.gacha_pulls(user_id, pool, reward_slug, reward_rarity) VALUES (uid, _pool, chosen_slug, chosen_rarity);

  -- Update pity counters
  IF chosen_rarity IN ('legendario', 'z') THEN
    UPDATE public.gacha_pity SET pulls_since_legendary = 0, pulls_since_special = 0, updated_at = now() WHERE user_id = uid;
  ELSIF chosen_rarity IN ('mitico', 'raro') THEN
    UPDATE public.gacha_pity SET pulls_since_legendary = pulls_since_legendary + 1, pulls_since_special = 0, updated_at = now() WHERE user_id = uid;
  ELSE
    UPDATE public.gacha_pity SET pulls_since_legendary = pulls_since_legendary + 1, pulls_since_special = pulls_since_special + 1, updated_at = now() WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'pool', _pool, 'slug', chosen_slug, 'name', chosen_name, 'image_url', chosen_image, 'rarity', chosen_rarity, 'special', false, 'duplicate', is_duplicate);
END;
$function$;
