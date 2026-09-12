import { supabase } from "@/integrations/supabase/client";
import { idbDelete, idbGet, idbSet } from "@/lib/idb-cache";
import { fuzzyTextScore, normalizeSearchText } from "@/lib/search-utils";
import type { AniListMedia } from "@/lib/anilist";

// v2 invalida catálogos vacíos guardados antes de que el RPC público incluyera
// aprobaciones por slug/Seeke. Es importante para instalaciones PWA y clones.
const CACHE_KEY = "approved-anime-search-catalog-v2";
const LEGACY_CACHE_KEY = "approved-anime-search-catalog-v1";
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
    idbDelete(LEGACY_CACHE_KEY).catch(() => {});
    const cached = await idbGet<ApprovedSearchRow[]>(CACHE_KEY);
    if (cached?.length) {
      memoryCatalog = cached;
      return cached;
    }

    // PostgREST corta a 1000 filas por respuesta: paginamos para no perder
    // animes aprobados que quedaban fuera del primer bloque.
    const rows: ApprovedSearchRow[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 20000; from += PAGE) {
      const { data, error } = await supabase
        .rpc("list_approved_anime_search_catalog")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = (data || []) as ApprovedSearchRow[];
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
    }
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
  idbDelete(LEGACY_CACHE_KEY).catch(() => {});
}

export async function searchApprovedAnimeCatalog(query: string, limit = 18): Promise<AniListMedia[]> {
  const normalized = normalizeSearchText(query);
  const compact = normalized.replace(/\s+/g, "");
  if (compact.length < 2) return [];

  const rows = await loadApprovedSearchCatalog();
  const matches = rows
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
    })) as AniListMedia[];

  if (!matches.length) return matches;

  // Rellena portada/título reales desde AniList (imágenes gratuitas de su CDN).
  // Si AniList falla, se conserva lo que ya teníamos guardado.
  try {
    const { getAnimesByIds } = await import("@/lib/anilist");
    const meta = await getAnimesByIds(matches.map((m) => m.id));
    return matches.map((m) => {
      const full = meta.get(m.id);
      if (!full) return m;
      return {
        ...full,
        title: {
          ...full.title,
          romaji: full.title?.romaji || m.title.romaji,
        },
        coverImage: {
          extraLarge: full.coverImage?.extraLarge || full.coverImage?.large || m.coverImage.extraLarge,
          large: full.coverImage?.large || full.coverImage?.extraLarge || m.coverImage.large,
          color: full.coverImage?.color ?? null,
        },
      };
    });
  } catch {
    return matches;
  }
}