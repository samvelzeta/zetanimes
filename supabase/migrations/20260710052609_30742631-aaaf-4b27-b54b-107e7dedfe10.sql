
ALTER TABLE public.profile_stats REPLICA IDENTITY FULL;
ALTER TABLE public.user_xp REPLICA IDENTITY FULL;
ALTER TABLE public.user_gacha_tokens REPLICA IDENTITY FULL;
ALTER TABLE public.user_gacha_inventory REPLICA IDENTITY FULL;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS enforce_max_profiles_trg ON public.account_profiles;
CREATE TRIGGER enforce_max_profiles_trg
  BEFORE INSERT ON public.account_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_profiles();

DROP TRIGGER IF EXISTS sync_anime_like_count_trg ON public.anime_likes;
CREATE TRIGGER sync_anime_like_count_trg
  AFTER INSERT OR DELETE ON public.anime_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_anime_like_count();

DROP TRIGGER IF EXISTS sync_anime_lists_stats_trg ON public.anime_lists;
CREATE TRIGGER sync_anime_lists_stats_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.anime_lists
  FOR EACH ROW EXECUTE FUNCTION public.sync_anime_lists_stats();

DROP TRIGGER IF EXISTS sync_watch_history_stats_trg ON public.watch_history;
CREATE TRIGGER sync_watch_history_stats_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.watch_history
  FOR EACH ROW EXECUTE FUNCTION public.sync_watch_history_stats();

DROP TRIGGER IF EXISTS on_watch_completed_award_trg ON public.watch_history;
CREATE TRIGGER on_watch_completed_award_trg
  AFTER INSERT OR UPDATE OF completed ON public.watch_history
  FOR EACH ROW EXECUTE FUNCTION public.on_watch_completed_award();

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles','account_profiles','account_settings','user_cosmetics',
    'admin_banners','admin_frames','premium_plan_configs','user_gacha_tokens',
    'user_xp'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END$$;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_gacha_tokens; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_gacha_inventory; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

INSERT INTO public.profile_stats (user_id, profile_id, episodes_completed, total_watch_seconds, lists_count, updated_at)
SELECT
  wh.user_id, wh.profile_id,
  COUNT(*) FILTER (WHERE wh.completed) AS eps,
  COALESCE(SUM(wh.watch_duration_seconds), 0)::bigint AS secs,
  0, now()
FROM public.watch_history wh
GROUP BY wh.user_id, wh.profile_id
ON CONFLICT (user_id, COALESCE(profile_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET
  episodes_completed = EXCLUDED.episodes_completed,
  total_watch_seconds = EXCLUDED.total_watch_seconds,
  updated_at = now();

UPDATE public.profile_stats ps
SET lists_count = sub.c, updated_at = now()
FROM (SELECT user_id, profile_id, COUNT(*)::int c FROM public.anime_lists GROUP BY user_id, profile_id) sub
WHERE ps.user_id = sub.user_id
  AND COALESCE(ps.profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = COALESCE(sub.profile_id, '00000000-0000-0000-0000-000000000000'::uuid);

WITH totals AS (
  SELECT user_id, COUNT(*)::int AS eps FROM public.watch_history WHERE completed = true GROUP BY user_id
)
INSERT INTO public.user_xp (user_id, xp, level, rank_slug, updated_at)
SELECT t.user_id, (t.eps * 50)::bigint,
  public.calc_level_from_xp((t.eps * 50)::bigint),
  public.calc_rank_from_level(public.calc_level_from_xp((t.eps * 50)::bigint)),
  now()
FROM totals t
ON CONFLICT (user_id) DO UPDATE SET
  xp = GREATEST(public.user_xp.xp, EXCLUDED.xp),
  level = public.calc_level_from_xp(GREATEST(public.user_xp.xp, EXCLUDED.xp)),
  rank_slug = public.calc_rank_from_level(public.calc_level_from_xp(GREATEST(public.user_xp.xp, EXCLUDED.xp))),
  updated_at = now();

WITH totals AS (
  SELECT user_id, COUNT(*)::int AS eps FROM public.watch_history WHERE completed = true GROUP BY user_id
)
INSERT INTO public.user_gacha_tokens (user_id, tokens, total_earned, last_awarded_at, updated_at)
SELECT t.user_id, (t.eps/10), (t.eps/10), now(), now()
FROM totals t WHERE (t.eps/10) > 0
ON CONFLICT (user_id) DO UPDATE SET
  tokens = GREATEST(public.user_gacha_tokens.tokens, EXCLUDED.tokens),
  total_earned = GREATEST(public.user_gacha_tokens.total_earned, EXCLUDED.total_earned),
  updated_at = now();
