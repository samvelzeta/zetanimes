import { supabase } from "@/integrations/supabase/client";

export function compactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/* ─────────── localStorage cache (espejo, no fuente de verdad) ─────────── */

const COUNTS_KEY = "zet:likes:counts";
const USER_LIKES_PREFIX = "zet:likes:user:"; // + userId → JSON string[]
const COUNT_TTL_MS = 5 * 60 * 1000; // 5min

type CountsCache = Record<string, { c: number; t: number }>;

function readCounts(): CountsCache {
  try { return JSON.parse(localStorage.getItem(COUNTS_KEY) || "{}"); } catch { return {}; }
}
function writeCounts(c: CountsCache) {
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify(c)); } catch {}
}

export function getCachedLikeCount(anilistId: number): number | null {
  const c = readCounts()[String(anilistId)];
  if (!c) return null;
  if (Date.now() - c.t > COUNT_TTL_MS) return null;
  return c.c;
}

function setCachedLikeCount(anilistId: number, count: number) {
  const c = readCounts();
  c[String(anilistId)] = { c: count, t: Date.now() };
  writeCounts(c);
}

function userLikesKey(userId: string) { return USER_LIKES_PREFIX + userId; }

function readUserLikes(userId: string): Set<number> {
  try {
    const raw = localStorage.getItem(userLikesKey(userId));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch { return new Set(); }
}
function writeUserLikes(userId: string, set: Set<number>) {
  try { localStorage.setItem(userLikesKey(userId), JSON.stringify(Array.from(set))); } catch {}
}

export function hasCachedUserLike(userId: string, anilistId: number): boolean {
  return readUserLikes(userId).has(anilistId);
}

function setUserLikeCached(userId: string, anilistId: number, liked: boolean) {
  const set = readUserLikes(userId);
  if (liked) set.add(anilistId); else set.delete(anilistId);
  writeUserLikes(userId, set);
}

/* ─────────── API pública ─────────── */

export async function getLikeCount(anilistId: number): Promise<number> {
  const { data, error } = await supabase.rpc("get_anime_like_count" as any, { _anilist_id: anilistId });
  if (error) {
    // Fallback: última copia cacheada aunque esté vencida
    const c = readCounts()[String(anilistId)];
    return c?.c ?? 0;
  }
  const n = Number(data || 0);
  setCachedLikeCount(anilistId, n);
  return n;
}

export async function hasUserLiked(userId: string, anilistId: number): Promise<boolean> {
  const { data } = await supabase
    .from("anime_likes" as any)
    .select("anilist_id")
    .eq("user_id", userId)
    .eq("anilist_id", anilistId)
    .maybeSingle();
  const liked = !!data;
  setUserLikeCached(userId, anilistId, liked);
  return liked;
}

export async function toggleLike(userId: string, anilistId: number, liked: boolean): Promise<void> {
  // Optimista en cache
  setUserLikeCached(userId, anilistId, !liked);
  const cached = getCachedLikeCount(anilistId);
  if (cached !== null) setCachedLikeCount(anilistId, Math.max(0, cached + (liked ? -1 : 1)));

  if (liked) {
    const { error } = await supabase.from("anime_likes" as any).delete().eq("user_id", userId).eq("anilist_id", anilistId);
    if (error) { setUserLikeCached(userId, anilistId, liked); throw error; }
  } else {
    const { error } = await supabase.from("anime_likes" as any).insert({ user_id: userId, anilist_id: anilistId } as any);
    if (error) { setUserLikeCached(userId, anilistId, liked); throw error; }
  }
}
