import { idbGet, idbSet } from "@/lib/idb-cache";

const ANILIST_URL = "https://graphql.anilist.co";

// TTL caché IndexedDB:
//  - 1h para listados (trending, popular, recientes)
//  - 7 días para anime individual finalizado
const TTL_HOME = 60 * 60 * 1000;

async function withIdbCache<T>(key: string, fetcher: () => Promise<T>, ttl = TTL_HOME): Promise<T> {
  const cached = await idbGet<T>(key);
  if (cached) return cached;
  const fresh = await fetcher();
  idbSet(key, fresh, ttl);
  return fresh;
}

const MEDIA_FRAGMENT = `
  fragment MediaFields on Media {
    id
    title { romaji english }
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
    nextAiringEpisode { airingAt episode }
  }
`;

async function queryAniList(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export interface AniListMedia {
  id: number;
  title: { romaji: string; english: string | null };
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
  return withIdbCache(`trending:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:TRENDING_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage });
    return data.Page;
  });
}

export async function getPopular(page = 1, perPage = 20): Promise<PageResult> {
  return withIdbCache(`popular:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage });
    return data.Page;
  });
}

export async function getRecentlyUpdated(page = 1, perPage = 20): Promise<PageResult> {
  return withIdbCache(`recent:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:UPDATED_AT_DESC,type:ANIME,status:RELEASING,isAdult:false){...MediaFields}}}`, { page, perPage });
    return data.Page;
  }, 30 * 60 * 1000); // 30min: cambia más seguido
}

export async function getTopRated(page = 1, perPage = 20): Promise<PageResult> {
  return withIdbCache(`toprated:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:SCORE_DESC,type:ANIME,isAdult:false,format_in:[TV,MOVIE]){...MediaFields}}}`, { page, perPage });
    return data.Page;
  }, 24 * 60 * 60 * 1000); // 24h
}

export async function getThisSeason(page = 1, perPage = 20): Promise<PageResult> {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const seasons = ["WINTER","WINTER","SPRING","SPRING","SPRING","SUMMER","SUMMER","SUMMER","FALL","FALL","FALL","WINTER"];
  const season = seasons[month];
  return withIdbCache(`season:${season}:${year}:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$season:MediaSeason,$year:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(season:$season,seasonYear:$year,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage, season, year });
    return data.Page;
  }, 6 * 60 * 60 * 1000); // 6h
}

/**
 * Búsqueda con fallback a Jikan (MyAnimeList).
 * Motivo: AniList GraphQL ha tenido el parámetro `search` devolviendo media:[] vacío
 * de forma intermitente. Cuando eso pasa, consultamos Jikan, mapeamos los mal_ids
 * y volvemos a pedir esos mismos animes a AniList por `idMal_in` para mantener el
 * shape consistente con el resto de la app.
 */
export async function searchAnime(searchTerm: string, page = 1, perPage = 20, genres: string[] = []): Promise<PageResult> {
  const variables: Record<string, unknown> = { page, perPage };
  if (searchTerm) variables.search = searchTerm;
  if (genres.length > 0) variables.genres = genres;
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$search:String,$genres:[String]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(search:$search,type:ANIME,genre_in:$genres,isAdult:false,sort:SEARCH_MATCH){...MediaFields}}}`, variables);

  // Fallback Jikan si AniList devolvió cero resultados con un término de búsqueda
  if (searchTerm && (!data?.Page?.media?.length)) {
    try {
      const jikanRes = await fetch(
        `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTerm)}&limit=${Math.min(perPage, 25)}&page=${page}&sfw=true`
      );
      if (jikanRes.ok) {
        const jikanJson = await jikanRes.json();
        const malIds: number[] = (jikanJson?.data || [])
          .map((a: any) => Number(a?.mal_id))
          .filter((n: number) => Number.isFinite(n) && n > 0)
          .slice(0, perPage);

        if (malIds.length > 0) {
          const idsCsv = malIds.join(",");
          const aniData = await queryAniList(
            `${MEDIA_FRAGMENT} query($perPage:Int){Page(page:1,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(idMal_in:[${idsCsv}],type:ANIME,isAdult:false){...MediaFields}}}`,
            { perPage: malIds.length }
          );
          const fetched: AniListMedia[] = aniData?.Page?.media || [];
          // Reordenar respetando el orden de relevancia que devolvió Jikan
          const order = new Map(malIds.map((id, i) => [id, i]));
          fetched.sort((a: any, b: any) => (order.get(a.idMal) ?? 999) - (order.get(b.idMal) ?? 999));
          const pag = jikanJson?.pagination || {};
          return {
            pageInfo: {
              total: pag?.items?.total || fetched.length,
              currentPage: page,
              lastPage: pag?.last_visible_page || page,
              hasNextPage: !!pag?.has_next_page,
            },
            media: fetched,
          };
        }
      }
    } catch {
      // si Jikan también falla, devolvemos lo que dio AniList (vacío)
    }
  }

  return data.Page;
}

export async function getAnimeById(id: number): Promise<AniListMedia> {
  return withIdbCache(`anime:${id}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($id:Int){Media(id:$id,type:ANIME){...MediaFields streamingEpisodes{title thumbnail url site}relations{edges{relationType node{id title{romaji english}coverImage{large}format type}}}recommendations(sort:RATING_DESC,perPage:10){nodes{mediaRecommendation{id title{romaji english}coverImage{large extraLarge}averageScore status format}}}}}`, { id });
    return data.Media;
  }, 24 * 60 * 60 * 1000);
}

export async function getByGenre(genre: string, page = 1, perPage = 20): Promise<PageResult> {
  return withIdbCache(`genre:${genre}:${page}:${perPage}`, async () => {
    const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$genre:String){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(genre:$genre,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage, genre });
    return data.Page;
  }, 6 * 60 * 60 * 1000);
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
