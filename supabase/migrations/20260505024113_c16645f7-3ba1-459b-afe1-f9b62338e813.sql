-- Restrict admin_payment_info SELECT to authenticated users (was publicly readable)
DROP POLICY IF EXISTS "Anyone can read payment info" ON public.admin_payment_info;
CREATE POLICY "Authenticated users can read payment info"
ON public.admin_payment_info
FOR SELECT
TO authenticated
USING (true);

-- Allow users to delete their own avatar files
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);