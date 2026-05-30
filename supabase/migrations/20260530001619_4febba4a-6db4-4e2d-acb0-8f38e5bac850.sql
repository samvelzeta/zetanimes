
ALTER TABLE public.premium_plan_configs
  ADD COLUMN IF NOT EXISTS uninterrupted_fullscreen boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_uninterrupted_fullscreen boolean NOT NULL DEFAULT true;

-- Activar por defecto en los 3 planes existentes
UPDATE public.premium_plan_configs
  SET uninterrupted_fullscreen = true,
      show_uninterrupted_fullscreen = true
  WHERE slug IN ('basico','solo','duo');

-- Asegurar entrada de fondo global para PremiumScreen en app_settings
INSERT INTO public.app_settings (key, value, description)
  VALUES ('premium_bg_url', '', 'Imagen de fondo decorativa para la pantalla de Obtener Premium')
  ON CONFLICT (key) DO NOTHING;
