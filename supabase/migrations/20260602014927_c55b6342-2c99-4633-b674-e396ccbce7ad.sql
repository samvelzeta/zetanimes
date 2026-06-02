REVOKE ALL ON FUNCTION public.admin_set_user_subscription(uuid, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_user_subscription(uuid, text, text, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_subscription(uuid, text, text, timestamptz) TO authenticated;