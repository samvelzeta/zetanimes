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
  return servers.filter((s) => s.embed).sort((a, b) => {
    const aIdx = SERVER_PRIORITY.findIndex((p) => a.name.toLowerCase().includes(p));
    const bIdx = SERVER_PRIORITY.findIndex((p) => b.name.toLowerCase().includes(p));
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

export async function resolveSlugFromTitle(title: string): Promise<string | null> {
  const results = await searchZetAnime(title);
  if (results.length > 0) return results[0].slug;
  return null;
}

export function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

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

export function getWatchedEpisodes(): string[] {
  try { return JSON.parse(localStorage.getItem(WATCHED_KEY) || "[]"); } catch { return []; }
}

export function markEpisodeWatched(episodeSlug: string): void {
  const watched = getWatchedEpisodes();
  if (!watched.includes(episodeSlug)) {
    watched.push(episodeSlug);
    localStorage.setItem(WATCHED_KEY, JSON.stringify(watched));
  }
}

export function isEpisodeWatched(episodeSlug: string): boolean {
  return getWatchedEpisodes().includes(episodeSlug);
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
