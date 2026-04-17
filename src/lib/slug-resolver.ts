// Multi-API slug resolver: Jikan, Kitsu, Shikimori + AniList title variants
// Valida coincidencia >=70% Dice antes de aceptar un slug.
import { searchZetAnime } from "./zetapi";
import { getSlugOverride, similarity } from "./slug-overrides";

interface SlugCandidate {
  slug: string;
  title: string;
  source: string;
}

const slugCache = new Map<string, string>();
const MIN_SIMILARITY = 0.7;

// Jikan (MyAnimeList) search
async function searchJikan(query: string): Promise<SlugCandidate[]> {
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5&sfw=true`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((item: any) => ({
      slug: item.title?.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "",
      title: item.title || "",
      source: "jikan",
    }));
  } catch { return []; }
}

// Kitsu search
async function searchKitsu(query: string): Promise<SlugCandidate[]> {
  try {
    const res = await fetch(`https://kitsu.app/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=5`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((item: any) => ({
      slug: item.attributes?.slug || "",
      title: item.attributes?.canonicalTitle || "",
      source: "kitsu",
    }));
  } catch { return []; }
}

// Shikimori search
async function searchShikimori(query: string): Promise<SlugCandidate[]> {
  try {
    const res = await fetch(`https://shikimori.one/api/animes?search=${encodeURIComponent(query)}&limit=5`, {
      headers: { "User-Agent": "ZetAnime" },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((item: any) => ({
      slug: item.url?.replace("/animes/", "").replace(/^[^-]+-/, "") || "",
      title: item.russian || item.name || "",
      source: "shikimori",
    }));
  } catch { return []; }
}

// Generate title variants from AniList data
function getTitleVariants(titleObj: { romaji: string; english: string | null }): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();
  const add = (s: string | null | undefined) => {
    if (!s) return;
    const t = s.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      variants.push(t);
    }
  };

  add(titleObj.romaji);
  add(titleObj.english);

  // Clean versions
  if (titleObj.romaji) {
    add(titleObj.romaji.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim());
    // Before colon/dash
    add(titleObj.romaji.split(/[:\-–—]/)[0].trim());
    // Remove season suffixes
    add(titleObj.romaji.replace(/\s*(Season|Part|Cour|S)\s*\d+/gi, "").trim());
    // First 3 words for long titles
    const words = titleObj.romaji.split(/\s+/);
    if (words.length >= 4) add(words.slice(0, 3).join(" "));
  }
  if (titleObj.english) {
    add(titleObj.english.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim());
    add(titleObj.english.split(/[:\-–—]/)[0].trim());
    add(titleObj.english.replace(/\s*(Season|Part|Cour|S)\s*\d+/gi, "").trim());
  }

  return variants;
}

// Try ZetAPI search with a query, return best match slug + matched title
async function tryZetSearch(query: string): Promise<{ slug: string; title: string } | null> {
  try {
    const results = await searchZetAnime(query);
    if (results.length > 0) return { slug: results[0].slug, title: results[0].title || "" };
  } catch {}
  return null;
}

/**
 * Resolve slug:
 * 1. Manual override (admin) → wins absolutamente
 * 2. AniList title variants → ZetAPI con validación similitud >=70%
 * 3. Jikan/Kitsu/Shikimori en paralelo → ZetAPI con validación
 * 4. Último recurso: titleToSlug del título principal sin validar
 */
export async function resolveSlugMultiAPI(
  titleObj: { romaji: string; english: string | null },
  anilistId?: number
): Promise<string | null> {
  // 0. Override manual
  if (anilistId) {
    const override = await getSlugOverride(anilistId);
    if (override) return override;
  }

  const cacheKey = anilistId ? `multi-${anilistId}` : `multi-${titleObj.romaji}`;
  if (slugCache.has(cacheKey)) return slugCache.get(cacheKey)!;

  const referenceTitles = [titleObj.romaji, titleObj.english].filter(Boolean) as string[];
  const isMatch = (candidateTitle: string) => {
    if (!candidateTitle) return false;
    return referenceTitles.some((t) => similarity(t, candidateTitle) >= MIN_SIMILARITY);
  };

  // 1. AniList variants → Zet con validación
  const variants = getTitleVariants(titleObj);
  for (const variant of variants) {
    const res = await tryZetSearch(variant);
    if (res && isMatch(res.title)) {
      slugCache.set(cacheKey, res.slug);
      return res.slug;
    }
  }

  // 2. APIs externas en paralelo
  const mainQuery = titleObj.romaji || titleObj.english || "";
  const [jikanResults, kitsuResults, shikimoriResults] = await Promise.allSettled([
    searchJikan(mainQuery),
    searchKitsu(mainQuery),
    searchShikimori(mainQuery),
  ]);

  const allCandidates: SlugCandidate[] = [];
  if (jikanResults.status === "fulfilled") allCandidates.push(...jikanResults.value);
  if (kitsuResults.status === "fulfilled") allCandidates.push(...kitsuResults.value);
  if (shikimoriResults.status === "fulfilled") allCandidates.push(...shikimoriResults.value);

  // Filtrar candidatos que coincidan al menos 70% con título AniList
  const validCandidates = allCandidates.filter((c) => isMatch(c.title));

  const triedSlugs = new Set<string>();
  for (const candidate of validCandidates) {
    if (candidate.slug && !triedSlugs.has(candidate.slug)) {
      triedSlugs.add(candidate.slug);
      const res = await tryZetSearch(candidate.slug);
      if (res && isMatch(res.title)) {
        slugCache.set(cacheKey, res.slug);
        return res.slug;
      }
    }
    if (candidate.title && !triedSlugs.has(candidate.title)) {
      triedSlugs.add(candidate.title);
      const res = await tryZetSearch(candidate.title);
      if (res && isMatch(res.title)) {
        slugCache.set(cacheKey, res.slug);
        return res.slug;
      }
    }
  }

  // 3. Último recurso: título principal a slug (puede fallar pero al menos intenta)
  const fallback = (titleObj.romaji || titleObj.english || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  if (fallback) {
    slugCache.set(cacheKey, fallback);
    return fallback;
  }

  return null;
}
