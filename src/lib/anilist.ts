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

// Timeout duro por intento — evita que un fetch colgado deje la UI cargando para siempre.
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function queryAniList(query: string, variables: Record<string, unknown> = {}, timeoutMs = 8000) {
  const key = JSON.stringify({ query, variables });
  const existing = inflight.get(key);
  if (existing) return existing;

  const run = (async () => {
    const maxAttempts = 3;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(
          ANILIST_URL,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
          },
          timeoutMs
        );
        // 403 deshabilitado, 405 a veces de AniList, 429 rate limit, 5xx transitorio. Señal clara de fallback.
        if (res.status === 403 || res.status === 405 || res.status === 429 || res.status >= 500) {

          if (attempt >= maxAttempts - 1) throw new Error(`AniList HTTP ${res.status}`);
          const retryAfter = Number(res.headers.get("Retry-After")) || 0;
          const wait = retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 600 * (attempt + 1);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const json = await res.json().catch(() => null);
        if (!res.ok || !json) throw new Error(`AniList HTTP ${res.status}`);
        if (json.errors) throw new Error(json.errors[0]?.message || "AniList error");
        return json.data;
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
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

/**
 * Fallback automático a Jikan (MyAnimeList) cuando AniList:
 * - devuelve 403/5xx/429, o
 * - excede el timeout de 8s.
 *
 * Import dinámico para evitar ciclo de imports con mal-fallback.ts.
 */
async function withJikanFallback(
  kind: Parameters<typeof import("./mal-fallback").jikanFallbackPage>[0],
  fetchAniList: () => Promise<PageResult>,
  page = 1,
  perPage = 20,
  genre?: string
): Promise<PageResult> {
  try {
    const result = await fetchAniList();
    if (result?.media?.length) return result;
  } catch (err) {
    console.warn("[anilist] fallback activado", kind, err);
  }

  const { jikanFallbackPage, processJikanPage } = await import("./mal-fallback");
  const fallback = await jikanFallbackPage(kind, page, perPage, genre);
  return processJikanPage(fallback);
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
  /** Verdadero si el anime proviene del fallback de Jikan (MyAnimeList). */
  isFallback?: boolean;
}



export interface PageResult {
  pageInfo: { total: number; currentPage: number; lastPage: number; hasNextPage: boolean };
  media: AniListMedia[];
}


export async function getTrending(page = 1, perPage = 20): Promise<PageResult> {
  return withJikanFallback(
    "trending",
    async () => {
      const result = await withIdbCache(`trending:${page}:${perPage}`, async () => {
        const data = await queryAniList(
          `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:TRENDING_DESC,type:ANIME,isAdult:false){...MediaFields}}}`,
          { page, perPage },
          6000
        );
        return data.Page;
      });
      return processPage(result);
    },
    page,
    perPage
  );
}

export async function getPopular(page = 1, perPage = 20): Promise<PageResult> {
  return withJikanFallback(
    "popular",
    async () => {
      const result = await withIdbCache(`popular:${page}:${perPage}`, async () => {
        const data = await queryAniList(
          `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`,
          { page, perPage },
          6000
        );
        return data.Page;
      });
      return processPage(result);
    },
    page,
    perPage
  );
}

export async function getRecentlyUpdated(page = 1, perPage = 20): Promise<PageResult> {
  return withJikanFallback(
    "recentlyUpdated",
    async () => {
      const result = await withIdbCache(
        `recent:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:UPDATED_AT_DESC,type:ANIME,status:RELEASING,isAdult:false){...MediaFields}}}`,
            { page, perPage },
            6000
          );
          return data.Page;
        },
        30 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage
  );
}

export async function getTopRated(page = 1, perPage = 20): Promise<PageResult> {
  return withJikanFallback(
    "topRated",
    async () => {
      const result = await withIdbCache(
        `toprated:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:SCORE_DESC,type:ANIME,isAdult:false,format_in:[TV,MOVIE]){...MediaFields}}}`,
            { page, perPage },
            6000
          );
          return data.Page;
        },
        24 * 60 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage
  );
}

export async function getMovies(page = 1, perPage = 30, genre?: string | null): Promise<PageResult> {
  const g = genre || "";
  return withJikanFallback(
    "movies",
    async () => {
      const result = await withIdbCache(
        `movies:${g}:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$genre:String){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,isAdult:false,genre:$genre){...MediaFields}}}`,
            { page, perPage, genre: g || undefined },
            6000
          );
          return data.Page;
        },
        6 * 60 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage
  );
}

/** Películas anunciadas / próximamente en AniList. */
export async function getUpcomingMovies(page = 1, perPage = 20): Promise<PageResult> {
  return withJikanFallback(
    "upcomingMovies",
    async () => {
      const result = await withIdbCache(
        `upcoming-movies:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,format:MOVIE,status:NOT_YET_RELEASED,isAdult:false){...MediaFields}}}`,
            { page, perPage },
            6000
          );
          return data.Page;
        },
        6 * 60 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage
  );
}

/** Películas ya estrenadas recientemente (RELEASING/FINISHED) ordenadas por fecha desc. */
export async function getRecentReleasedMovies(page = 1, perPage = 30): Promise<PageResult> {
  return withJikanFallback(
    "movies",
    async () => {
      const result = await withIdbCache(
        `recent-released-movies:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:START_DATE_DESC,type:ANIME,format:MOVIE,status_in:[RELEASING,FINISHED],isAdult:false){...MediaFields}}}`,
            { page, perPage },
            6000
          );
          return data.Page;
        },
        6 * 60 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage
  );
}




export async function getThisSeason(page = 1, perPage = 20): Promise<PageResult> {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const seasons = ["WINTER","WINTER","SPRING","SPRING","SPRING","SUMMER","SUMMER","SUMMER","FALL","FALL","FALL","WINTER"];
  const season = seasons[month];
  return withJikanFallback(
    "thisSeason",
    async () => {
      const result = await withIdbCache(
        `season:${season}:${year}:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$season:MediaSeason,$year:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(season:$season,seasonYear:$year,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`,
            { page, perPage, season, year },
            6000
          );
          return data.Page;
        },
        6 * 60 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage
  );
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
      variables,
      5000
    );
  };

  if (!cleanTerm || page > 1) {
    try {
      const data = await runAniListSearch(cleanTerm);
      return processPage(data.Page, options);
    } catch (err) {
      console.warn("[anilist/search] AniList falló, fallback a Jikan", err);
      const { jikanSearch, processJikanPage } = await import("./mal-fallback");
      return processJikanPage(await jikanSearch(cleanTerm, page, perPage, genres[0]), options);
    }
  }

  // Un solo variant en tiempo real: menos disparos = menos 429 = búsqueda estable.
  const variants = [cleanTerm];
  const seen = new Map<number, AniListMedia>();
  let firstPageInfo: PageResult["pageInfo"] | null = null;
  let anilistFailed = false;
  try {
    const pageData = (await runAniListSearch(variants[0], Math.min(Math.max(perPage, 18), 30)))?.Page;
    if (pageData?.pageInfo) firstPageInfo = pageData.pageInfo;
    for (const media of pageData?.media || []) {
      if (!seen.has(media.id)) seen.set(media.id, media);
    }
  } catch {
    anilistFailed = true;
  }

  if (anilistFailed || seen.size < Math.min(perPage, 12)) {
    try {
      const jikanQuery = variants[0] || normalizeSearchText(cleanTerm);
      const { jikanSearch: searchJikan, processJikanPage } = await import("./mal-fallback");
      const jikanPage = await searchJikan(jikanQuery, page, Math.min(Math.max(perPage, 12), 25), genres[0]);
      // Combinamos resultados de Jikan con los de AniList (si los hay), evitando duplicados.
      for (const media of jikanPage.media) {
        if (!seen.has(media.id)) seen.set(media.id, media);
      }
      if (anilistFailed) {
        return processJikanPage(jikanPage, options);
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
  let result = await withIdbCache(`anime:${id}`, async () => {
    try {
      const data = await queryAniList(
        `${MEDIA_FRAGMENT} query($id:Int){Media(id:$id,type:ANIME){...MediaFields streamingEpisodes{title thumbnail url site}relations{edges{relationType node{id title{romaji english}coverImage{large}format type}}}recommendations(sort:RATING_DESC,perPage:10){nodes{mediaRecommendation{id title{romaji english}coverImage{large extraLarge}averageScore status format}}}}}`,
        { id },
        6000
      );
      return data.Media;
    } catch (err) {
      // Si AniList falla, intentamos Jikan por id (suponiendo que id sea mal_id).
      // No es perfecto, pero evita pantallas en blanco cuando AniList está caído.
      const { jikanGetById } = await import("./mal-fallback");
      const fallback = await jikanGetById(id);
      if (fallback) return fallback;
      throw err;
    }
  }, 24 * 60 * 60 * 1000);
  const [withStatus] = await applyStatusOverrides([result]);
  return withStatus;
}

export async function getByGenre(genre: string, page = 1, perPage = 20): Promise<PageResult> {
  return withJikanFallback(
    "genre",
    async () => {
      const result = await withIdbCache(
        `genre:${genre}:${page}:${perPage}`,
        async () => {
          const data = await queryAniList(
            `${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$genre:String){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(genre:$genre,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`,
            { page, perPage, genre },
            6000
          );
          return data.Page;
        },
        6 * 60 * 60 * 1000
      );
      return processPage(result);
    },
    page,
    perPage,
    genre
  );
}


export function getTitle(media: AniListMedia): string {
  // Prioriza romaji; si no existe, cae a english y por último native.
  return media?.title?.romaji || media?.title?.english || media?.title?.native || "Sin título";
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
