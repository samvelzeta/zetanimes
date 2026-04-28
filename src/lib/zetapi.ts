// ZetAPI client - API key is stored server-side in edge function
const ZET_BASE = "https://zetapi-api.samvelzeta.workers.dev/api";
const PROXY_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zet-proxy`;

export interface ZetServer {
  name: string;
  embed?: string;
  download?: string;
}

export interface ZetEpisodeServers {
  title: string;
  number: number;
  servers: ZetServer[];
}

export interface ZetLatestEpisode {
  title: string;
  number: number;
  cover: string;
  slug: string;
  url: string;
}

export interface ZetSearchResult {
  title: string;
  cover: string;
  synopsis: string;
  rating: string;
  slug: string;
  type: string;
  url: string;
}

const SERVER_PRIORITY = [
  "filemoon", "streamwish", "sw", "vidhide", "stape",
  "yourupload", "okru", "doodstream", "streamtape",
  "fembed", "mega", "netu", "maru",
];

export function sortServersByPriority(servers: ZetServer[]): ZetServer[] {
  return (servers || []).filter((s) => s && s.embed).sort((a, b) => {
    const aName = (a?.name || "").toLowerCase();
    const bName = (b?.name || "").toLowerCase();
    const aIdx = SERVER_PRIORITY.findIndex((p) => aName.includes(p));
    const bIdx = SERVER_PRIORITY.findIndex((p) => bName.includes(p));
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });
}

// Proxy authenticated requests through edge function (hides API key)
async function zetProxyFetch<T>(apiPath: string): Promise<T> {
  const url = `${PROXY_BASE}?path=${encodeURIComponent(apiPath)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ZetProxy ${res.status}: ${body}`);
  }
  return await res.json();
}

// Direct fetch for public endpoints (no API key needed)
async function zetDirectFetch<T>(path: string): Promise<T> {
  const url = `${ZET_BASE}${path}`;
  const res = await fetch(url, { method: "GET", headers: { "Accept": "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ZetAPI ${res.status}: ${body}`);
  }
  return await res.json();
}

export async function getLatestEpisodes(): Promise<ZetLatestEpisode[]> {
  const res = await zetDirectFetch<{ success: boolean; data: ZetLatestEpisode[] }>("/list/latest-episodes");
  return res.data || [];
}

export async function searchZetAnime(query: string): Promise<ZetSearchResult[]> {
  const res = await zetProxyFetch<{ success: boolean; data: ZetSearchResult[] }>(`/search?query=${encodeURIComponent(query)}`);
  return res.data || [];
}

export async function getEpisodeServers(slug: string, epNumber: number, lang: string = "sub"): Promise<ZetEpisodeServers> {
  const res = await zetDirectFetch<{ success: boolean; data: ZetEpisodeServers }>(`/anime/${slug}/episode/${epNumber}?lang=${lang}`);
  return res.data;
}

export async function getSeekeEpisode(baseUrl: string, epNumber: number): Promise<{ embed: string; episode: number; cached?: boolean }> {
  const res = await zetProxyFetch<{ ok: boolean; episode?: number; embed?: string; cached?: boolean; error?: string }>(
    `/anime/episode-seeke?url=${encodeURIComponent(baseUrl)}&ep=${epNumber}`
  );

  if (!res.ok || !res.embed) {
    throw new Error(res.error || "No se pudo obtener el episodio");
  }

  return { embed: res.embed, episode: res.episode || epNumber, cached: res.cached };
}

// ===== IMPROVED SLUG RESOLUTION =====

// In-memory slug cache for the session
const slugMemoryCache = new Map<string, string>();

/**
 * Clean a title to create a proper slug search term
 * Removes season indicators, special chars, etc.
 */
function cleanTitleForSearch(title: string): string[] {
  const seen = new Set<string>();
  const variants: string[] = [];
  const add = (s: string) => { const t = s.trim(); if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); variants.push(t); } };

  // 1. Original title
  add(title);

  // 2. Strip punctuation (commas, periods, colons, etc.) but keep spaces
  const noPunct = title.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  add(noPunct);

  // 3. Remove season/part suffixes
  const noSeason = noPunct
    .replace(/\s*(Season|Part|Cour|S)\s*\d+/gi, "")
    .replace(/\s*(2nd|3rd|\d+th)\s*(Season|Part|Cour)/gi, "")
    .replace(/\s*\d+$/, "")
    .trim();
  add(noSeason);

  // 4. Before colon/dash/comma (main name only)
  const mainName = title.split(/[:\-–—,]/)[0].trim();
  add(mainName);
  add(mainName.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim());

  // 5. For long titles (5+ words), try first 4 words, then first 3
  const words = noPunct.split(/\s+/);
  if (words.length >= 5) {
    add(words.slice(0, 4).join(" "));
    add(words.slice(0, 3).join(" "));
  }
  if (words.length >= 4) {
    add(words.slice(0, 3).join(" "));
  }

  return variants;
}

/**
 * Resolve slug from title with multiple search strategies and caching
 */
export async function resolveSlugFromTitle(title: string, anilistId?: number): Promise<string | null> {
  // Check memory cache first
  const cacheKey = anilistId ? `id-${anilistId}` : `title-${title}`;
  if (slugMemoryCache.has(cacheKey)) {
    return slugMemoryCache.get(cacheKey)!;
  }
  
  // Try multiple search variants
  const searchVariants = cleanTitleForSearch(title);
  
  for (const variant of searchVariants) {
    try {
      const results = await searchZetAnime(variant);
      if (results.length > 0) {
        // Find best match by comparing titles
        const bestMatch = findBestSlugMatch(title, results);
        const slug = bestMatch.slug;
        slugMemoryCache.set(cacheKey, slug);
        return slug;
      }
    } catch {
      // Try next variant
      continue;
    }
  }
  
  return null;
}

/**
 * Find the best matching result from search results
 */
function findBestSlugMatch(originalTitle: string, results: ZetSearchResult[]): ZetSearchResult {
  const normalizedOriginal = originalTitle.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  
  let bestMatch = results[0];
  let bestScore = 0;
  
  for (const result of results) {
    const normalizedResult = result.title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
    
    // Exact match
    if (normalizedResult === normalizedOriginal) return result;
    
    // Calculate similarity score
    const words = normalizedOriginal.split(/\s+/);
    const matchedWords = words.filter(w => normalizedResult.includes(w));
    const score = matchedWords.length / words.length;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }
  
  return bestMatch;
}

export function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// ===== SLUG CACHE DB OPERATIONS =====

export async function getCachedSlug(anilistId: number): Promise<string | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("slug_cache")
      .select("slug")
      .eq("anilist_id", anilistId)
      .maybeSingle();
    if (data?.slug) {
      slugMemoryCache.set(`id-${anilistId}`, data.slug);
      return data.slug;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveCachedSlug(anilistId: number, slug: string, title: string): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.from("slug_cache").upsert(
      { anilist_id: anilistId, slug, title } as any,
      { onConflict: "anilist_id" }
    );
    slugMemoryCache.set(`id-${anilistId}`, slug);
  } catch {
    // Silently fail - cache is optional
  }
}

// ===== LATINO HLS EPISODES =====

export interface LatinoEpisode {
  slug: string;
  episode_number: number;
  sources: { hls: string[] };
  status: string;
}

export async function getLatinoEpisode(slug: string, episodeNumber: number): Promise<LatinoEpisode | null> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase
      .from("latino_episodes")
      .select("*")
      .eq("slug", slug)
      .eq("episode_number", episodeNumber)
      .eq("status", "uploaded")
      .maybeSingle();
    return data as unknown as LatinoEpisode | null;
  } catch {
    return null;
  }
}

// ===== WATCH HISTORY (localStorage) =====

export interface WatchHistoryEntry {
  animeSlug: string;
  animeTitle: string;
  animeCover: string;
  episodeSlug: string;
  episodeNumber: number;
  currentTime: number;
  duration: number;
  progress: number;
  timestamp: number;
  anilistId?: number;
}

const HISTORY_KEY = "zet_watch_history";
const MAX_HISTORY = 30;

export function getWatchHistory(): WatchHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

export function saveWatchProgress(entry: WatchHistoryEntry): void {
  const history = getWatchHistory().filter((h) => h.episodeSlug !== entry.episodeSlug);
  history.unshift({ ...entry, timestamp: Date.now() });
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

const WATCHED_KEY = "zet_watched_episodes";

function watchedKey(scope?: string | null): string {
  return scope ? `${WATCHED_KEY}:${scope}` : WATCHED_KEY;
}

export function getWatchedEpisodes(scope?: string | null): string[] {
  try { return JSON.parse(localStorage.getItem(watchedKey(scope)) || "[]"); } catch { return []; }
}

export function setWatchedEpisodes(episodes: string[], scope?: string | null): void {
  localStorage.setItem(watchedKey(scope), JSON.stringify(episodes));
}

export function markEpisodeWatched(episodeSlug: string, scope?: string | null): void {
  const watched = getWatchedEpisodes(scope);
  if (!watched.includes(episodeSlug)) {
    watched.push(episodeSlug);
    setWatchedEpisodes(watched, scope);
  }
}

export function isEpisodeWatched(episodeSlug: string, scope?: string | null): boolean {
  return getWatchedEpisodes(scope).includes(episodeSlug);
}

export function detectAdblock(): Promise<boolean> {
  return new Promise((resolve) => {
    const bait = document.createElement("div");
    bait.className = "adsbox ad-banner textads";
    bait.style.cssText = "position:absolute;top:-999px;left:-999px;width:1px;height:1px;";
    document.body.appendChild(bait);
    setTimeout(() => {
      const blocked = bait.offsetHeight === 0 || bait.offsetParent === null;
      bait.remove();
      resolve(blocked);
    }, 150);
  });
}
