import { supabase } from "@/integrations/supabase/client";

/**
 * Sistema de vistas reales por anime.
 * - Anti-spam: 1 vista por sesión (sessionStorage)
 * - Storage: tabla `anime_views` (anilist_id + view_count)
 * - Increment: función SQL `increment_anime_view(_anilist_id)`
 */

const SESSION_KEY = "zet_viewed_animes";

function getSessionViewed(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function markSessionViewed(anilistId: number) {
  try {
    const set = getSessionViewed();
    set.add(anilistId);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

/**
 * Suma +1 vista al anime, máximo 1 por sesión.
 * No bloquea la UI (fire-and-forget).
 */
export async function trackAnimeView(anilistId: number): Promise<void> {
  if (!anilistId || getSessionViewed().has(anilistId)) return;
  markSessionViewed(anilistId);
  try {
    await supabase.rpc("increment_anime_view" as any, {
      _anilist_id: anilistId,
    });
  } catch {
    /* swallow — ofrece UX silenciosa */
  }
}

/**
 * Lee el conteo actual de vistas para un anime.
 */
export async function getAnimeViews(anilistId: number): Promise<number> {
  if (!anilistId) return 0;
  const { data } = await supabase
    .from("anime_views" as any)
    .select("view_count")
    .eq("anilist_id", anilistId)
    .maybeSingle();
  return ((data as any)?.view_count as number) || 0;
}

/**
 * Lee el conteo de varios animes a la vez (para carruseles).
 */
export async function getAnimeViewsBatch(
  anilistIds: number[]
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  if (!anilistIds.length) return map;
  const { data } = await supabase
    .from("anime_views" as any)
    .select("anilist_id, view_count")
    .in("anilist_id", anilistIds);
  ((data as any[]) || []).forEach((r: any) => {
    map.set(r.anilist_id, Number(r.view_count) || 0);
  });
  return map;
}

/**
 * Formatea un número de vistas en formato compacto (1.2K, 3.4M).
 */
export function formatViews(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}K`.replace(".0", "");
  return `${(n / 1_000_000).toFixed(1)}M`.replace(".0", "");
}
