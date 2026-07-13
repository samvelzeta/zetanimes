import { idbGet, idbSet } from "@/lib/idb-cache";
import { applyAnimeCurationPage } from "@/lib/anime-curation";
import { applyStatusOverrides } from "@/lib/anime-status-overrides";
import { buildLooseSearchVariants, fuzzyTextScore, normalizeSearchText } from "@/lib/search-utils";

const ANILIST_URL = "https://graphql.anilist.co";
const CATALOG_CACHE_VERSION = "curation-v1";

// TTL caché IndexedDB:
//  - 1h para listados (trending, popular, recientes)
//  - 7 días para anime individual finalizado
const TTL_HOME = 60 * 60 * 1000;

async function withIdbCache<T>(key: string, fetcher: () => Promise<T>, ttl = TTL_HOME): Promise<T> {
  const versionedKey = `${CATALOG_CACHE_VERSION}:${key}`;
  const cached = await idbGet<T>(versionedKey);
  if (cached) return cached;
  const fresh = await fetcher();
  idbSet(versionedKey, fresh, ttl);
  return fresh;
}

const MEDIA_FRAGMENT = `
  fragment MediaFields on Media {
    id
    idMal
    title { romaji english native }
    synonyms
    coverImage { extraLarge large color }
    bannerImage
    description(asHtml: false)
    genres
    averageScore
    popularity
    status
    episodes
    season
    seasonYear
    format
    countryOfOrigin
    tags { name }
    startDate { year month day }
    nextAiringEpisode { airingAt episode }
  }
`;


async function processPage<T extends PageResult>(page: T, options?: { skipCuration?: boolean }): Promise<T> {
  const curated = await applyAnimeCurationPage(page, options);
  return { ...curated, media: await applyStatusOverrides(curated.media || []) };
}

// Deduplica requests idénticas en vuelo (evita disparar 3-4 copias por tecla).
const inflight = new Map<string, Promise<any>>();

async function queryAniList(query: string, variables: Record<string, unknown> = {}) {
  const key = JSON.stringify({ query, variables });
  const existing = inflight.get(key);
  if (existing) return existing;

  const run = (async () => {
    const maxAttempts = 4;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetch(ANILIST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        });
        // 429 = rate limit; 5xx = transitorio. Reintentar con backoff.
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get("Retry-After")) || 0;
          const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(1500 * Math.pow(2, attempt), 8000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) throw new Error(`AniList HTTP ${res.status}`);
        if (json.errors) throw new Error(json.errors[0]?.message || "AniList error");
        return json.data;
      } catch (err) {
        lastErr = err;
        // Solo reintentar errores de red; errores de GraphQL ya se lanzaron arriba.
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt)));
          continue;
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("AniList request failed");
  })();

  inflight.set(key, run);
  try {
    return await run;
  } finally {
    inflight.delete(key);
  }
}

export interface AniListMedia {
  id: number;
  idMal?: number | null;
  title: { romaji: string; english: string | null; native?: string | null };
  synonyms?: string[] | null;
  coverImage: { extraLarge: string; large: string; color: string | null };
  bannerImage: string | null;
  description: string | null;
  genres: string[];
  averageScore: number | null;
  popularity: number;
  status: string;
  episodes: number | null;
  season: string | null;
  seasonYear: number | null;
  format: string | null;
  countryOfOrigin?: string | null;
  tags?: { name: string }[];
  startDate?: { year: number | null; month: number | null; day: number | null } | null;
  nextAiringEpisode: { airingAt: number; episode: number } | null;
  streamingEpisodes?: { title: string; thumbnail: string; url: string; site: string }[];
  relations?: { edges: { relationType: string; node: { id: number; title: { romaji: string; english: string | null }; coverImage: { large: string }; format: string; type: string } }[] };
  recommendations?: { nodes: { mediaRecommendation: { id: number; title: { romaji: string; english: string | null }; coverImage: { large: string; extraLarge: string }; averageScore: number; status: string; format: string } }[] };
}


interface PageResult {
  pageInfo: { total: number; currentPage: number; lastPage: number; hasNextPage: boolean };
  media: AniListMedia[];
}

export async function getTrending(page = 1, perPage = 20): Promise<PageResult> {
  const result = await withIdbCache(`trending:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:TRENDING_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage });
    return data.Page;
  });
  return processPage(result);
}

export async function getPopular(page = 1, perPage = 20): Promise<PageResult> {
  const result = await withIdbCache(`popular:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage });
    return data.Page;
  });
  return processPage(result);
}

export async function getRecentlyUpdated(page = 1, perPage = 20): Promise<PageResult> {
  const result = await withIdbCache(`recent:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:UPDATED_AT_DESC,type:ANIME,status:RELEASING,isAdult:false){...MediaFields}}}`, { page, perPage });
    return data.Page;
  }, 30 * 60 * 1000); // 30min: cambia más seguido
  return processPage(result);
}

export async function getTopRated(page = 1, perPage = 20): Promise<PageResult> {
  const result = await withIdbCache(`toprated:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:SCORE_DESC,type:ANIME,isAdult:false,format_in:[TV,MOVIE]){...MediaFields}}}`, { page, perPage });
    return data.Page;
  }, 24 * 60 * 60 * 1000); // 24h
  return processPage(result);
}

export async function getMovies(page = 1, perPage = 30, genre?: string | null): Promise<PageResult> {
  const g = genre || "";
  const result = await withIdbCache(`movies:${g}:${page}:${perPage}`, async () => {
    const data = await queryAniList(
      `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$genre:String){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,isAdult:false,genre:$genre){...MediaFields}}}`,
      { page, perPage, genre: g || undefined }
    );
    return data.Page;
  }, 6 * 60 * 60 * 1000);
  return processPage(result);
}

/** Películas anunciadas / próximamente en AniList. */
export async function getUpcomingMovies(page = 1, perPage = 20): Promise<PageResult> {
  const result = await withIdbCache(`upcoming-movies:${page}:${perPage}`, async () => {
    const data = await queryAniList(
      `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,status:NOT_YET_RELEASED,isAdult:false){...MediaFields}}}`,
      { page, perPage }
    );
    return data.Page;
  }, 6 * 60 * 60 * 1000);
  return processPage(result);
}

/** Películas ya estrenadas recientemente (RELEASING/FINISHED) ordenadas por fecha desc. */
export async function getRecentReleasedMovies(page = 1, perPage = 30): Promise<PageResult> {
  const result = await withIdbCache(`recent-released-movies:${page}:${perPage}`, async () => {
    const data = await queryAniList(
      `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:START_DATE_DESC,type:ANIME,format:MOVIE,status_in:[RELEASING,FINISHED],isAdult:false){...MediaFields}}}`,
      { page, perPage }
    );
    return data.Page;
  }, 6 * 60 * 60 * 1000);
  return processPage(result);
}



export async function getThisSeason(page = 1, perPage = 20): Promise<PageResult> {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const seasons = ["WINTER","WINTER","SPRING","SPRING","SPRING","SUMMER","SUMMER","SUMMER","FALL","FALL","FALL","WINTER"];
  const season = seasons[month];
  const result = await withIdbCache(`season:${season}:${year}:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$season:MediaSeason,$year:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(season:$season,seasonYear:$year,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage, season, year });
    return data.Page;
  }, 6 * 60 * 60 * 1000); // 6h
  return processPage(result);
}

/**
 * Búsqueda con fallback a Jikan (MyAnimeList).
 * Motivo: AniList GraphQL ha tenido el parámetro `search` devolviendo media:[] vacío
 * de forma intermitente. Cuando eso pasa, consultamos Jikan, mapeamos los mal_ids
 * y volvemos a pedir esos mismos animes a AniList por `idMal_in` para mantener el
 * shape consistente con el resto de la app.
 */
export async function searchAnime(searchTerm: string, page = 1, perPage = 20, genres: string[] = [], options?: { skipCuration?: boolean }): Promise<PageResult> {
  const cleanTerm = searchTerm.trim();
  const baseVariables: Record<string, unknown> = { page, perPage };
  if (genres.length > 0) baseVariables.genres = genres;

  const runAniListSearch = async (term: string, limit = perPage) => {
    const variables: Record<string, unknown> = { ...baseVariables, perPage: limit };
    if (term) variables.search = term;
    return queryAniList(
      `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$search:String,$genres:[String]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(search:$search,type:ANIME,genre_in:$genres,isAdult:false,sort:SEARCH_MATCH){...MediaFields}}}`,
      variables
    );
  };

  if (!cleanTerm || page > 1) {
    const data = await runAniListSearch(cleanTerm);
    return processPage(data.Page, options);
  }

  const variants = buildLooseSearchVariants(cleanTerm, 3);
  const batches = await Promise.allSettled(variants.map((variant) => runAniListSearch(variant, Math.min(Math.max(perPage, 18), 30))));
  const seen = new Map<number, AniListMedia>();
  let firstPageInfo: PageResult["pageInfo"] | null = null;

  for (const batch of batches) {
    if (batch.status !== "fulfilled") continue;
    const pageData = batch.value?.Page;
    if (!firstPageInfo && pageData?.pageInfo) firstPageInfo = pageData.pageInfo;
    for (const media of pageData?.media || []) {
      if (!seen.has(media.id)) seen.set(media.id, media);
    }
  }

  if (seen.size < Math.min(perPage, 12)) {
    try {
      const jikanQuery = variants[0] || normalizeSearchText(cleanTerm);
      const jikanRes = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(jikanQuery)}&limit=${Math.min(Math.max(perPage, 12), 25)}&page=${page}&sfw=true`
      );
      if (jikanRes.ok) {
        const jikanJson = await jikanRes.json();
        const malIds: number[] = (jikanJson?.data || [])
          .map((a: any) => Number(a?.mal_id))
          .filter((n: number) => Number.isFinite(n) && n > 0)
          .slice(0, Math.min(Math.max(perPage, 12), 25));

        if (malIds.length > 0) {
          const aniData = await queryAniList(
            `${MEDIA_FRAGMENT} query($ids:[Int],$perPage:Int){Page(page:1,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(idMal_in:$ids,type:ANIME,isAdult:false){...MediaFields}}}`,
            { ids: malIds, perPage: malIds.length }
          );
          const order = new Map(malIds.map((id, i) => [id, i]));
          const fetched: AniListMedia[] = aniData?.Page?.media || [];
          fetched.sort((a: any, b: any) => (order.get(a.idMal) ?? 999) - (order.get(b.idMal) ?? 999));
          fetched.forEach((media) => {
            if (!seen.has(media.id)) seen.set(media.id, media);
          });
        }
      }
    } catch {
      // Si el fallback falla, se conserva lo encontrado con AniList.
    }
  }

  const allScored = Array.from(seen.values()).map((media, index) => ({
    media,
    index,
    score: fuzzyTextScore(cleanTerm, [
      media.title?.romaji,
      media.title?.english,
      media.title?.native,
      ...((media.synonyms || []) as string[]),
    ]),
  }));

  // Permissive: keep anything with any signal (>0). If nothing scores, keep all
  // (AniList already matched them by search term, so they are relevant).
  const filtered = allScored.filter((item) => item.score > 0);
  const pool = filtered.length > 0 ? filtered : allScored;

  const scored = pool
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.media)
    .slice(0, perPage);

  const pageResult = {
    pageInfo: firstPageInfo || { total: scored.length, currentPage: page, lastPage: page, hasNextPage: false },
    media: scored,
  };

  return processPage(pageResult, options);
}

export async function getAnimeById(id: number): Promise<AniListMedia> {
  const result = await withIdbCache(`anime:${id}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($id:Int){Media(id:$id,type:ANIME){...MediaFields streamingEpisodes{title thumbnail url site}relations{edges{relationType node{id title{romaji english}coverImage{large}format type}}}recommendations(sort:RATING_DESC,perPage:10){nodes{mediaRecommendation{id title{romaji english}coverImage{large extraLarge}averageScore status format}}}}}`, { id });
    return data.Media;
  }, 24 * 60 * 60 * 1000);
  const [withStatus] = await applyStatusOverrides([result]);
  return withStatus;
}

export async function getByGenre(genre: string, page = 1, perPage = 20): Promise<PageResult> {
  const result = await withIdbCache(`genre:${genre}:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$genre:String){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(genre:$genre,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage, genre });
    return data.Page;
  }, 6 * 60 * 60 * 1000);
  return processPage(result);
}

export function getTitle(media: AniListMedia): string {
  return media?.title?.english || media?.title?.romaji || "Sin título";
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    RELEASING: "EN EMISIÓN", FINISHED: "FINALIZADO", NOT_YET_RELEASED: "PRÓXIMAMENTE", CANCELLED: "CANCELADO", HIATUS: "EN PAUSA",
  };
  return map[status] || status;
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    RELEASING: "bg-primary", FINISHED: "bg-accent", NOT_YET_RELEASED: "bg-yellow-600", CANCELLED: "bg-red-800", HIATUS: "bg-muted-foreground",
  };
  return map[status] || "bg-muted-foreground";
}
