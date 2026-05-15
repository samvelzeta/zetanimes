
-- Plans CRUD
CREATE TABLE IF NOT EXISTS public.premium_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_label text NOT NULL,
  period text NOT NULL DEFAULT 'monthly',
  membership_type text NOT NULL DEFAULT 'annual',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  badge text,
  accent_color text,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read enabled plans" ON public.premium_plans FOR SELECT USING (true);
CREATE POLICY "Owners manage plans" ON public.premium_plans FOR ALL
  USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_premium_plans_updated BEFORE UPDATE ON public.premium_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Settings singleton
CREATE TABLE IF NOT EXISTS public.premium_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'ZetAnime Premium',
  subtitle text NOT NULL DEFAULT 'Disfruta sin límites',
  description text DEFAULT 'Beneficios reales, sin promesas vacías',
  character_image_url text,
  background_image_url text,
  alt_payment_url text,
  stripe_enabled boolean NOT NULL DEFAULT false,
  stripe_payment_url text,
  layout_mode text NOT NULL DEFAULT 'lateral',
  show_proof_form boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.premium_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read premium settings" ON public.premium_settings FOR SELECT USING (true);
CREATE POLICY "Owners manage premium settings" ON public.premium_settings FOR ALL
  USING (public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'owner'::app_role));

CREATE TRIGGER trg_premium_settings_updated BEFORE UPDATE ON public.premium_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed singleton row + default plans
INSERT INTO public.premium_settings (id) VALUES (gen_random_uuid()) ON CONFLICT DO NOTHING;

INSERT INTO public.premium_plans (name, price_label, period, membership_type, features, badge, sort_order)
SELECT 'Anual', '$12.99/año', 'yearly', 'annual',
  '["Sin anuncios","Exportar historial PDF","8 colores premium","Badge dorado","PIN de cuenta","3 dispositivos"]'::jsonb,
  'Popular', 0
WHERE NOT EXISTS (SELECT 1 FROM public.premium_plans);

INSERT INTO public.premium_plans (name, price_label, period, membership_type, features, sort_order)
SELECT 'Para Siempre', '$29.99 único', 'lifetime', 'lifetime',
  '["Todo lo del Anual","Pago único","Sin renovación"]'::jsonb,
  1
WHERE (SELECT COUNT(*) FROM public.premium_plans) < 2;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('premium-assets', 'premium-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Premium assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'premium-assets');

CREATE POLICY "Owners manage premium assets" ON storage.objects FOR ALL
  USING (bucket_id = 'premium-assets' AND public.has_role(auth.uid(), 'owner'::app_role))
  WITH CHECK (bucket_id = 'premium-assets' AND public.has_role(auth.uid(), 'owner'::app_role));
