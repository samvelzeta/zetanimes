UPDATE public.premium_plan_configs
SET quality_enabled = true,
    quality_max = 'fhd',
    show_quality = true,
    quality_label = 'Calidad Full HD'
WHERE slug IN ('basico', 'solo', 'duo');