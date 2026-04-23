// Galería de avatares: trae personajes populares de AniList.
// Solo guardamos la URL (string), no la imagen.
import { idbGet, idbSet } from "@/lib/idb-cache";

const ANILIST_URL = "https://graphql.anilist.co";
const TTL = 24 * 60 * 60 * 1000; // 24h

export interface AvatarOption {
  id: number;
  name: string;
  image: string;
  source: string; // anime al que pertenece
}

const QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full }
        image { large }
        media(perPage: 1, sort: POPULARITY_DESC) {
          nodes { title { romaji english } }
        }
      }
    }
  }
`;

export async function fetchAvatarOptions(page = 1, perPage = 30): Promise<AvatarOption[]> {
  const cacheKey = `anilist:avatars:p${page}:n${perPage}`;
  const cached = await idbGet<AvatarOption[]>(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { page, perPage } }),
    });
    const json = await res.json();
    const chars = json?.data?.Page?.characters || [];
    const out: AvatarOption[] = chars
      .filter((c: any) => c?.image?.large)
      .map((c: any) => ({
        id: c.id,
        name: c.name?.full || "Personaje",
        image: c.image.large,
        source: c.media?.nodes?.[0]?.title?.english || c.media?.nodes?.[0]?.title?.romaji || "",
      }));
    idbSet(cacheKey, out, TTL);
    return out;
  } catch {
    return [];
  }
}

export async function searchAvatars(term: string): Promise<AvatarOption[]> {
  if (!term.trim()) return [];
  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Page(perPage: 24) {
              characters(search: $search, sort: FAVOURITES_DESC) {
                id
                name { full }
                image { large }
                media(perPage: 1, sort: POPULARITY_DESC) {
                  nodes { title { romaji english } }
                }
              }
            }
          }
        `,
        variables: { search: term.trim() },
      }),
    });
    const json = await res.json();
    const chars = json?.data?.Page?.characters || [];
    return chars
      .filter((c: any) => c?.image?.large)
      .map((c: any) => ({
        id: c.id,
        name: c.name?.full || "Personaje",
        image: c.image.large,
        source: c.media?.nodes?.[0]?.title?.english || c.media?.nodes?.[0]?.title?.romaji || "",
      }));
  } catch {
    return [];
  }
}
