-- Quitar SELECT a nivel de tabla y otorgarlo columna a columna, excluyendo pin_hash.
REVOKE SELECT ON public.account_profiles FROM authenticated;
REVOKE SELECT ON public.account_profiles FROM anon;

GRANT SELECT (id, user_id, name, avatar_url, accent_color, font_family, is_default, created_at, updated_at, pin_enabled)
  ON public.account_profiles TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.account_profiles TO authenticated;
GRANT ALL ON public.account_profiles TO service_role;