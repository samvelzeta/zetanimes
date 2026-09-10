import { supabase } from "@/integrations/supabase/client";
import { idbDelete, idbGet, idbSet } from "@/lib/idb-cache";
import { fuzzyTextScore, normalizeSearchText } from "@/lib/search-utils";
import type { AniListMedia } from "@/lib/anilist";

const CACHE_KEY = "approved-anime-search-catalog-v1";
const CACHE_TTL = 5 * 60 * 1000;

type ApprovedSearchRow = {
  anilist_id: number;
  title: string | null;
  slug: string | null;
  cover_image: string | null;
};

let memoryCatalog: ApprovedSearchRow[] | null = null;
let inflight: Promise<ApprovedSearchRow[]> | null = null;

async function loadApprovedSearchCatalog(): Promise<ApprovedSearchRow[]> {
  if (memoryCatalog) return memoryCatalog;
  if (inflight) return inflight;

  inflight = (async () => {
    const cached = await idbGet<ApprovedSearchRow[]>(CACHE_KEY);
    if (cached) {
      memoryCatalog = cached;
      return cached;
    }

    const { data, error } = await supabase.rpc("list_approved_anime_search_catalog");
    if (error) throw error;
    const rows = (data || []) as ApprovedSearchRow[];
    memoryCatalog = rows;
    await idbSet(CACHE_KEY, rows, CACHE_TTL);
    return rows;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function clearApprovedSearchCatalogCache() {
  memoryCatalog = null;
  inflight = null;
  idbDelete(CACHE_KEY).catch(() => {});
}

export async function searchApprovedAnimeCatalog(query: string, limit = 18): Promise<AniListMedia[]> {
  const normalized = normalizeSearchText(query);
  const compact = normalized.replace(/\s+/g, "");
  if (compact.length < 2) return [];

  const rows = await loadApprovedSearchCatalog();
  return rows
    .map((row) => {
      const score = fuzzyTextScore(query, [row.title, row.slug?.replace(/-/g, " ")]);
      return { row, score };
    })
    .filter(({ score }) => score >= (compact.length <= 3 ? 2.2 : 1.25))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({
      id: row.anilist_id,
      title: { romaji: row.title || row.slug?.replace(/-/g, " ") || `Anime #${row.anilist_id}`, english: null },
      synonyms: row.slug ? [row.slug.replace(/-/g, " ")] : [],
      coverImage: { extraLarge: row.cover_image || "", large: row.cover_image || "", color: null },
      bannerImage: null,
      description: null,
      genres: [],
      averageScore: null,
      popularity: 0,
      status: "FINISHED",
      episodes: null,
      season: null,
      seasonYear: null,
      format: "TV",
      nextAiringEpisode: null,
    }));
}