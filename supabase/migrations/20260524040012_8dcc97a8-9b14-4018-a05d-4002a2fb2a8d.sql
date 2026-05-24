
-- 1) Profiles: require authentication for SELECT
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2) Remove tables from Realtime publication that should not broadcast cross-user
ALTER PUBLICATION supabase_realtime DROP TABLE public.user_roles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.device_sessions;

-- 3) Restrict public bucket listing: only allow reading individual objects, not listing
-- Avatars and premium-assets remain publicly accessible by URL, but listing is denied.
DO $$
BEGIN
  -- Drop overly broad SELECT policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Avatar images are publicly accessible' AND polrelid = 'storage.objects'::regclass) THEN
    DROP POLICY "Avatar images are publicly accessible" ON storage.objects;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Premium assets are publicly accessible' AND polrelid = 'storage.objects'::regclass) THEN
    DROP POLICY "Premium assets are publicly accessible" ON storage.objects;
  END IF;
END $$;

-- Re-create as narrower SELECT (still allows fetching by URL via public bucket)
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Premium assets are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'premium-assets');
