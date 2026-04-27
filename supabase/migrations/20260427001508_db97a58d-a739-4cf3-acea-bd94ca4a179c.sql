UPDATE public.watch_history wh
SET profile_id = main_profile.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM public.account_profiles
  ORDER BY user_id, is_default DESC, created_at ASC
) main_profile
WHERE wh.user_id = main_profile.user_id
  AND wh.profile_id IS NULL;

UPDATE public.anime_lists al
SET profile_id = main_profile.id
FROM (
  SELECT DISTINCT ON (user_id) id, user_id
  FROM public.account_profiles
  ORDER BY user_id, is_default DESC, created_at ASC
) main_profile
WHERE al.user_id = main_profile.user_id
  AND al.profile_id IS NULL;