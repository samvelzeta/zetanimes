const ANILIST_URL = "https://graphql.anilist.co";

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
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:TRENDING_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage });
  return data.Page;
}

export async function getPopular(page = 1, perPage = 20): Promise<PageResult> {
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage });
  return data.Page;
}

export async function getRecentlyUpdated(page = 1, perPage = 20): Promise<PageResult> {
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:UPDATED_AT_DESC,type:ANIME,status:RELEASING,isAdult:false){...MediaFields}}}`, { page, perPage });
  return data.Page;
}

export async function getTopRated(page = 1, perPage = 20): Promise<PageResult> {
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(sort:SCORE_DESC,type:ANIME,isAdult:false,format_in:[TV,MOVIE]){...MediaFields}}}`, { page, perPage });
  return data.Page;
}

export async function getThisSeason(page = 1, perPage = 20): Promise<PageResult> {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const seasons = ["WINTER","WINTER","SPRING","SPRING","SPRING","SUMMER","SUMMER","SUMMER","FALL","FALL","FALL","WINTER"];
  const season = seasons[month];
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$season:MediaSeason,$year:Int){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(season:$season,seasonYear:$year,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage, season, year });
  return data.Page;
}

export async function searchAnime(searchTerm: string, page = 1, perPage = 20, genres: string[] = []): Promise<PageResult> {
  const variables: Record<string, unknown> = { page, perPage };
  if (searchTerm) variables.search = searchTerm;
  if (genres.length > 0) variables.genres = genres;
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$search:String,$genres:[String]){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(search:$search,type:ANIME,genre_in:$genres,isAdult:false,sort:SEARCH_MATCH){...MediaFields}}}`, variables);
  return data.Page;
}

export async function getAnimeById(id: number): Promise<AniListMedia> {
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($id:Int){Media(id:$id,type:ANIME){...MediaFields streamingEpisodes{title thumbnail url site}relations{edges{relationType node{id title{romaji english}coverImage{large}format type}}}recommendations(sort:RATING_DESC,perPage:10){nodes{mediaRecommendation{id title{romaji english}coverImage{large extraLarge}averageScore status format}}}}}`, { id });
  return data.Media;
}

export async function getByGenre(genre: string, page = 1, perPage = 20): Promise<PageResult> {
  const data = await queryAniList(`${MEDIA_FRAGMENT} query($page:Int,$perPage:Int,$genre:String){Page(page:$page,perPage:$perPage){pageInfo{total currentPage lastPage hasNextPage}media(genre:$genre,sort:POPULARITY_DESC,type:ANIME,isAdult:false){...MediaFields}}}`, { page, perPage, genre });
  return data.Page;
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
