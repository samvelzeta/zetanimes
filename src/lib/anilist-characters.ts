// Personajes populares de AniList para el Directorio (bio, poderes, anime origen).
import { idbGet, idbSet } from "@/lib/idb-cache";
import { translateText } from "@/lib/translate";

const ANILIST_URL = "https://graphql.anilist.co";
const TTL = 6 * 60 * 60 * 1000; // 6h

export interface AniListCharacter {
  id: number;
  name: string;
  image: string;
  description: string; // limpio (sin HTML)
  favourites: number;
  gender: string | null;
  age: string | null;
  animeId: number | null;
  animeTitle: string;
  animeCover: string | null;
}

const QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full }
        image { large }
        description(asHtml: false)
        favourites
        gender
        age
        media(perPage: 1, sort: POPULARITY_DESC, type: ANIME) {
          nodes {
            id
            title { romaji english }
            coverImage { large }
          }
        }
      }
    }
  }
`;

function cleanDesc(raw: string | null): string {
  if (!raw) return "";
  return raw
    .replace(/~!.*?!~/gs, "") // spoilers
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\r?\n{2,}/g, "\n")
    .trim();
}

export async function getPopularCharacters(page = 1, perPage = 25): Promise<AniListCharacter[]> {
  const key = `anilist:chars:popular:p${page}:n${perPage}:v3-es`;
  const cached = await idbGet<AniListCharacter[]>(key);
  if (cached) return cached;
  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { page, perPage } }),
    });
    const json = await res.json();
    const chars = json?.data?.Page?.characters || [];
    const base: AniListCharacter[] = chars
      .filter((c: any) => c?.image?.large && c?.description)
      .map((c: any) => {
        const media = c.media?.nodes?.[0];
        return {
          id: c.id,
          name: c.name?.full || "Personaje",
          image: c.image.large,
          description: cleanDesc(c.description),
          favourites: c.favourites || 0,
          gender: c.gender || null,
          age: c.age || null,
          animeId: media?.id ?? null,
          animeTitle: media?.title?.english || media?.title?.romaji || "",
          animeCover: media?.coverImage?.large || null,
        };
      });

    // Traducimos las bios al español en paralelo (con cache por-personaje en translateText).
    const out = await Promise.all(
      base.map(async (c) => {
        try {
          const translated = await translateText(c.description, `char_bio_${c.id}`);
          return { ...c, description: translated || c.description };
        } catch {
          return c;
        }
      })
    );

    idbSet(key, out, TTL);
    return out;
  } catch {
    return [];
  }
}
