import { supabase } from "@/integrations/supabase/client";

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

export async function getLikeCount(anilistId: number): Promise<number> {
  const { data, error } = await supabase.rpc("get_anime_like_count" as any, { _anilist_id: anilistId });
  if (error) return 0;
  return Number(data || 0);
}

export async function hasUserLiked(userId: string, anilistId: number): Promise<boolean> {
  const { data } = await supabase
    .from("anime_likes" as any)
    .select("anilist_id")
    .eq("user_id", userId)
    .eq("anilist_id", anilistId)
    .maybeSingle();
  return !!data;
}

export async function toggleLike(userId: string, anilistId: number, liked: boolean): Promise<void> {
  if (liked) {
    await supabase.from("anime_likes" as any).delete().eq("user_id", userId).eq("anilist_id", anilistId);
  } else {
    await supabase.from("anime_likes" as any).insert({ user_id: userId, anilist_id: anilistId } as any);
  }
}
