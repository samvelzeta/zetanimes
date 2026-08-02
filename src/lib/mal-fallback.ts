/**
 * Fallback a MyAnimeList vía Jikan (api.jikan.moe/v4) cuando AniList
 * devuelve 403/5xx o excede un timeout razonable.
 *
 * Jikan usa mal_id; lo mapeamos al campo id de AniListMedia para mantener
 * la UI funcional. No es idéntico a AniList, pero evita pantallas vacías.
 */

import { applyStatusOverrides } from "./anime-status-overrides";
import { idbGet, idbSet } from "./idb-cache";
import type { AniListMedia, PageResult } from "./anilist";

const JIKAN_BASE = "https://api.jikan.moe/v4";
const TTL = 24 * 60 * 60 * 1000; // 24h

type JikanStatus =
  | "Finished Airing"
  | "Currently Airing"
  | "Not yet aired"
  | string;

const STATUS_MAP: Record<string, AniListMedia["status"]> = {
  "Finished Airing": "FINISHED",
  "Currently Airing": "RELEASING",
  "Not yet aired": "NOT_YET_RELEASED",
};

const JIKAN_SEASONS: Record<string, string> = {
  "winter": "WINTER",
  "spring": "SPRING",
  "summer": "SUMMER",
  "fall": "FALL",
};

const JIKAN_FORMATS: Record<string, string> = {
  "TV": "TV",
  "TV Short": "TV_SHORT",
  "Movie": "MOVIE",
  "OVA": "OVA",
  "ONA": "ONA",
  "Special": "SPECIAL",
  "Music": "MUSIC",
};

function jikanStatusToAniList(status: JikanStatus): AniListMedia["status"] {
  return STATUS_MAP[status] || "FINISHED";
}

function jikanImageUrl(item: any): string {
  return (
    item?.images?.jpg?.large_image_url ||
    item?.images?.jpg?.image_url ||
    item?.images?.webp?.large_image_url ||
    item?.images?.webp?.image_url ||
    ""
  );
}

function jikanBannerUrl(item: any): string | null {
  return (
    item?.trailer?.images?.maximum_image_url ||
    item?.trailer?.images?.large_image_url ||
    null
  );
}

function jikanGenres(item: any): string[] {
  return (item?.genres || []).map((g: any) => g.name).filter(Boolean);
}

function jikanTags(item: any): { name: string }[] {
  return (item?.themes || []).map((t: any) => ({ name: t.name })).filter(Boolean);
}

function parseYearMonthDay(iso: string | null | undefined) {
  if (!iso) return { year: null, month: null, day: null };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { year: null, month: null, day: null };
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function jikanToAniListMedia(item: any): AniListMedia {
  const id = item?.mal_id || item?.id;
  const title: AniListMedia["title"] = {
    romaji: item.title || item.title_japanese || item.title_english || "",
    english: item.title_english || null,
    native: item.title_japanese || null,
  };
  // Si romaji quedó vacío pero hay inglés, usamos inglés como principal.
  if (!title.romaji && title.english) {
    title.romaji = title.english;
    title.english = null;
  }

  return {
    id: typeof id === "number" ? id : 0,
    idMal: typeof id === "number" ? id : null,
    title,
    synonyms: [item.title_english, item.title_japanese].filter(Boolean),
    coverImage: {
      extraLarge: jikanImageUrl(item),
      large: jikanImageUrl(item),
      color: null,
    },
    bannerImage: jikanBannerUrl(item),
    description: item.synopsis || null,
    genres: jikanGenres(item),
    averageScore: typeof item.score === "number" ? item.score : null,
    popularity: typeof item.scored_by === "number" ? item.scored_by : 0,
    status: jikanStatusToAniList(item.status),
    episodes: typeof item.episodes === "number" ? item.episodes : null,
    season: JIKAN_SEASONS[item.season] || null,
    seasonYear: typeof item.year === "number" ? item.year : null,
    format: JIKAN_FORMATS[item.type] || null,
    countryOfOrigin: "JP",
    tags: jikanTags(item),
    startDate: parseYearMonthDay(item.aired?.from),
    nextAiringEpisode: null,
    isFallback: true,
  };

}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function jikanGet(path: string, timeoutMs = 7000) {
  const url = `${JIKAN_BASE}${path}`;
  const cacheKey = `jikan:${path}`;
  try {
    const cached = await idbGet<any>(cacheKey);
    if (cached && Array.isArray(cached.data)) return cached.data;
  } catch {
    // IndexedDB puede fallar; seguimos sin caché.
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchWithTimeout(url, timeoutMs);
      if (res.status === 429 || res.status >= 500) {
        const delay = 1000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (!res.ok) return null;
      const json = await res.json().catch(() => null);
      const data = json?.data || null;
      if (Array.isArray(data)) {
        await idbSet(cacheKey, { data }, TTL).catch(() => {});
      }
      return data;
    } catch {
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  return null;
}


export function jikanPageResult(
  items: any[],
  page = 1,
  perPage = 20,
  hasNextPage = false
): PageResult {
  return {
    pageInfo: {
      total: items.length,
      currentPage: page,
      lastPage: hasNextPage ? page + 1 : page,
      hasNextPage,
    },
    media: items.map(jikanToAniListMedia),
  };
}

/** Top animes: equivalente a trending/popular/top rated. */
export async function jikanTopAnime(
  page = 1,
  perPage = 20,
  filter?: "airing" | "upcoming" | "bypopularity" | "favorite" | null
): Promise<PageResult> {
  const filterParam = filter ? `&filter=${filter}` : "";
  // Jikan parece más estable con limit=25+; pedimos un poco más y recortamos.
  const jikanLimit = Math.max(perPage, 25);
  const data = await jikanGet(`/top/anime?page=${page}&limit=${jikanLimit}${filterParam}`);
  const items = Array.isArray(data) ? data : data?.data || [];
  return jikanPageResult(
    items.slice(0, perPage),
    page,
    perPage,
    items.length >= perPage
  );
}


/** Temporada actual. */
export async function jikanCurrentSeason(
  page = 1,
  perPage = 20
): Promise<PageResult> {
  const jikanLimit = Math.max(perPage, 25);
  const data = await jikanGet(`/seasons/now?page=${page}&limit=${jikanLimit}`);
  const items = Array.isArray(data) ? data : data?.data || [];
  return jikanPageResult(
    items.slice(0, perPage),
    page,
    perPage,
    items.length >= perPage
  );
}


/** Películas recientes/top. */
export async function jikanTopMovies(
  page = 1,
  perPage = 20
): Promise<PageResult> {
  const data = await jikanGet(`/top/anime?type=movie&page=${page}&limit=${perPage}`);
  const items = Array.isArray(data) ? data : data?.data || [];
  return jikanPageResult(
    items.slice(0, perPage),
    page,
    perPage,
    items.length >= perPage
  );
}

/** Búsqueda general. */
export async function jikanSearch(
  q: string,
  page = 1,
  perPage = 20,
  genre?: string
): Promise<PageResult> {
  const genreParam = genre ? `&genres=${encodeURIComponent(genre)}` : "";
  const data = await jikanGet(
    `/anime?q=${encodeURIComponent(q || "")}&page=${page}&limit=${perPage}&sfw=true${genreParam}`,
    8000
  );
  const items = Array.isArray(data) ? data : data?.data || [];
  return jikanPageResult(
    items.slice(0, perPage),
    page,
    perPage,
    items.length >= perPage
  );
}

/** Detalle por mal_id. */
export async function jikanGetById(malId: number): Promise<AniListMedia | null> {
  const key = `jikan-anime:${malId}`;
  const cached = await idbGet<AniListMedia>(key);
  if (cached) return cached;

  const data = await jikanGet(`/anime/${malId}/full`);
  if (!data) return null;
  const media = jikanToAniListMedia(data);
  await idbSet(key, media, TTL);
  return media;
}

/**
 * Fallback completo: intenta resolver por término/genre/página y devuelve
 * un PageResult que se procesa igual que AniList.
 */
export async function jikanFallbackPage(
  kind:
    | "trending"
    | "popular"
    | "topRated"
    | "recentlyUpdated"
    | "thisSeason"
    | "movies"
    | "upcomingMovies"
    | "genre",
  page = 1,
  perPage = 20,
  genre?: string
): Promise<PageResult> {
  switch (kind) {
    case "trending":
      return jikanTopAnime(page, perPage, "airing");
    case "popular":
      return jikanTopAnime(page, perPage, "bypopularity");
    case "topRated":
      return jikanTopAnime(page, perPage, "favorite");
    case "recentlyUpdated":
      return jikanTopAnime(page, perPage, "airing");
    case "thisSeason":
      return jikanCurrentSeason(page, perPage);
    case "movies":
      return jikanTopMovies(page, perPage);
    case "upcomingMovies":
      return jikanTopAnime(page, perPage, "upcoming");
    case "genre":
      return jikanSearch("", page, perPage, genre);
    default:
      return jikanTopAnime(page, perPage);
  }
}

/** Aplica curación y overrides de status sobre un resultado Jikan. */
export async function processJikanPage(
  page: PageResult,
  options?: { skipCuration?: boolean }
): Promise<PageResult> {
  const { applyAnimeCurationPage } = await import("./anime-curation");
  const curated = await applyAnimeCurationPage(page, options);
  return {
    ...curated,
    media: await applyStatusOverrides(curated.media || []),
  };
}
