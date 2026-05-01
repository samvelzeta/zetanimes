// Multi-source resolver for total episode count.
// Order: admin override > AniList episodes > AniList nextAiringEpisode-1 > Jikan > fallback
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet } from "@/lib/idb-cache";
import type { AniListMedia } from "@/lib/anilist";

const TTL = 30 * 60 * 1000; // 30 min

export async function getOverrideCount(anilistId: number): Promise<number | null> {
  if (!anilistId) return null;
  const cacheKey = `epcount-override:${anilistId}`;
  const cached = await idbGet<number | null>(cacheKey);
  if (cached !== undefined && cached !== null) return cached;
  const { data } = await supabase
    .from("episode_count_overrides")
    .select("episode_count")
    .eq("anilist_id", anilistId)
    .maybeSingle();
  const value = data?.episode_count ?? null;
  if (value) idbSet(cacheKey, value, TTL);
  return value;
}

async function getJikanCount(anilistId: number, title?: string): Promise<number | null> {
  // Jikan supports MAL ids only; AniList Media gives idMal but our cached object may not.
  // Try by title search as fallback.
  if (!title) return null;
  try {
    const r = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
    const j = await r.json();
    const item = j?.data?.[0];
    return item?.episodes ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves the total number of episodes available to render in the grid.
 * Always returns at least 1.
 */
export async function resolveEpisodeCount(media: AniListMedia | undefined, anilistId: number): Promise<number> {
  // 1. Admin override wins
  const override = await getOverrideCount(anilistId);
  if (override && override > 0) return override;

  if (!media) return 1;

  const isReleasing = media.status === "RELEASING";

  // 2. CRÍTICO: Si el anime está EN EMISIÓN, prioriza nextAiringEpisode-1 (capítulos REALMENTE emitidos)
  // No usar media.episodes porque ese es el TOTAL planeado, no los emitidos.
  if (isReleasing && media.nextAiringEpisode?.episode && media.nextAiringEpisode.episode > 1) {
    return media.nextAiringEpisode.episode - 1;
  }

  // 3. Anime finalizado: usar media.episodes
  if (!isReleasing && media.episodes && media.episodes > 0) return media.episodes;

  // 4. Si está en emisión pero no hay nextAiringEpisode (raro), intentar Jikan
  const title = media.title?.romaji || media.title?.english;
  if (isReleasing && title) {
    const jikan = await getJikanCount(anilistId, title);
    if (jikan && jikan > 0) return jikan;
    // Último recurso: 1 capítulo (no inflar con totales)
    return 1;
  }

  // 5. Anime finalizado sin episodes: fallback a Jikan
  if (title) {
    const jikan = await getJikanCount(anilistId, title);
    if (jikan && jikan > 0) return jikan;
  }

  return media.episodes || 1;
}
