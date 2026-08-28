// ZetAPI client - API key is stored server-side in edge function
import { supabase } from "@/integrations/supabase/client";

const ZET_BASE = "https://zetapi-api.samvelzeta.workers.dev/api";
const PROXY_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/zet-proxy`;


export interface ZetServer {
  name: string;
  embed?: string;
  download?: string;
}

export interface ZetSubtitle {
  lang: string;
  url: string;
  label?: string;
}

export interface ZetEpisodeServers {
  title: string;
  number: number;
  servers: ZetServer[];
  subtitles?: ZetSubtitle[];
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
    cache: "no-store",
    headers: { "Accept": "application/json", "Cache-Control": "no-store" },
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
  // No enviar Cache-Control al Worker público: ese header dispara preflight CORS
  // y el upstream no lo permite. `cache: "no-store"` basta para el navegador.
  const res = await fetch(url, { method: "GET", cache: "no-store", headers: { "Accept": "application/json" } });
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

const SEEKE_BOT_URL = "https://a24785-7a2f.xs1.onjrnm.link/extraer";
export type SeekeQuality = { label: string; url: string };
type SeekeResolved = { embed: string; episode: number; cached?: boolean; subtitles?: ZetSubtitle[]; latest_episode?: number; qualities?: SeekeQuality[] };

export function clearSeekeEpisodeCache() {
  // Limpieza legacy: ya no se lee cache local de Seeke, pero borramos entradas
  // viejas de navegadores/admins para que no contaminen sesiones abiertas.
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("zet:seeke:"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {}
}

function normalizeSeekeSubs(raw: any): ZetSubtitle[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({
      lang: String(s?.lang || s?.language || s?.srclang || "es"),
      url: String(s?.url || s?.src || ""),
      label: s?.label ? String(s.label) : undefined,
    }))
    .filter((s) => !!s.url);
}

function normalizeSeekeQualities(raw: any): SeekeQuality[] {
  if (!raw || typeof raw !== "object") return [];
  const out: SeekeQuality[] = [];
  for (const [label, url] of Object.entries(raw)) {
    if (typeof url === "string" && url) out.push({ label: String(label), url });
  }
  return out;
}

function normalizeSeekeRequestUrl(baseUrl: string) {
  const clean = baseUrl.trim();
  try {
    const url = new URL(clean);
    url.search = "";
    url.hash = "";
    url.pathname = url.pathname.replace(/\/\d+\/?$/, "");
    return url.toString();
  } catch {
    return clean.replace(/\/\d+\/?$/, "");
  }
}

export async function getSeekeEpisode(baseUrl: string, epNumber: number): Promise<SeekeResolved> {
  // Sin cache local: cada reproducción pide directo a la VPS con el episodio exacto.
  let resolved: SeekeResolved | null = null;
  const requestUrl = normalizeSeekeRequestUrl(baseUrl);
  try {
    const cacheBust = Date.now();
    const r = await fetch(SEEKE_BOT_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-store", Pragma: "no-cache" },
      body: JSON.stringify({ url: requestUrl, ep: epNumber, no_cache: true, force: true, cache_bust: cacheBust }),
    });
    if (r.ok) {
      const data = await r.json();
      if (data?.ok && data?.embed) {
        resolved = {
          embed: String(data.embed),
          episode: Number(data.episode || epNumber),
          cached: !!data.cached,
          subtitles: normalizeSeekeSubs(data.subtitles),
          latest_episode: Number.isFinite(Number(data.latest_episode)) ? Number(data.latest_episode) : undefined,
          qualities: normalizeSeekeQualities(data.calidades ?? data.qualities),
        };
      }
    }
  } catch {}

  // 2) Fallback al proxy/Cloudflare si el bot directo falla (CORS u otro)
  if (!resolved) {
    const cacheBust = Date.now();
    const res = await zetProxyFetch<{ ok: boolean; episode?: number; embed?: string; cached?: boolean; subtitles?: any[]; latest_episode?: number; calidades?: Record<string, string>; qualities?: Record<string, string>; error?: string }>(
      `/anime/episode-seeke?url=${encodeURIComponent(requestUrl)}&ep=${epNumber}&no_cache=1&force=1&_=${cacheBust}`
    );
    if (!res.ok || !res.embed) {
      throw new Error(res.error || "No se pudo obtener el episodio");
    }
    resolved = {
      embed: res.embed,
      episode: res.episode || epNumber,
      cached: res.cached,
      subtitles: normalizeSeekeSubs(res.subtitles),
      latest_episode: Number.isFinite(Number(res.latest_episode)) ? Number(res.latest_episode) : undefined,
      qualities: normalizeSeekeQualities(res.calidades ?? res.qualities),
    };
  }

  return resolved;
}

/**
 * Refresca SOLO `latest_episode` para una URL madre Seeke. No reemplaza el embed
 * ni los subtítulos, solo actualiza el contador para que el frontend pueda
 * mostrar episodios nuevos sin tocar el reproductor.
 */
async function refreshLatestEpisode(baseUrl: string, epNumber: number): Promise<number | undefined> {
  try {
    const requestUrl = normalizeSeekeRequestUrl(baseUrl);
    const cacheBust = Date.now();
    const r = await fetch(SEEKE_BOT_URL, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Cache-Control": "no-store", Pragma: "no-cache" },
      body: JSON.stringify({ url: requestUrl, ep: epNumber, latest_only: true, no_cache: true, force: true, cache_bust: cacheBust }),
    });
    if (!r.ok) return undefined;
    const data = await r.json();
    const latest = Number(data?.latest_episode);
    if (!Number.isFinite(latest)) return undefined;
    return latest;
  } catch {
    return undefined;
  }
}

/**
 * API pública: obtiene el último episodio disponible para una URL madre Seeke.
 * Devuelve `undefined` si la VPS aún no ha resuelto el dato.
 * ⚠️ Legacy: solo debe usarse desde el panel admin. El flujo público usa
 * `resolveStreamLatest(anilistId, lang)`.
 */
export async function getLatestEpisodeForBase(baseUrl: string, hintEp = 1): Promise<number | undefined> {
  const freshLatest = await refreshLatestEpisode(baseUrl, hintEp);
  if (freshLatest) return freshLatest;

  // Sin cache: si el endpoint ligero falla, pedimos el episodio real a la VPS.
  try {
    const result = await getSeekeEpisode(baseUrl, hintEp);
    return result.latest_episode;
  } catch {
    return undefined;
  }
}

// ============================================================================
// 🔒 Resolución segura vía edge function `resolve-stream`
// El navegador NUNCA ve la URL madre. Solo manda { anilistId, lang, ep }.
// El servidor la busca vía service_role y llama a la VPS.
// ============================================================================
// Invoca la edge function con timeout duro. Si el usuario aborta o pasa el
// tiempo, devuelve un rechazo para que el caller pueda reintentar/caer al
// siguiente source sin congelar el player.
async function invokeWithTimeout(body: unknown, timeoutMs: number) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // supabase-js v2 acepta AbortSignal en el 2º arg
    return await supabase.functions.invoke("resolve-stream", {
      body: body as any,
      // @ts-ignore - signal soportado en runtime aunque no en tipos viejos
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveStreamEpisode(
  anilistId: number,
  lang: string,
  ep: number,
  variant: number = 1
): Promise<SeekeResolved> {
  const body = { action: "episode", anilistId, lang, ep, variant };
  // Reintentos con timeouts crecientes para tolerar cold start del edge/VPS.
  let data: any = null;
  let lastErr: any = null;
  for (const timeout of [6000, 12000]) {
    try {
      const res = await invokeWithTimeout(body, timeout);
      if (!res.error && res.data?.ok && res.data?.embed) { data = res.data; break; }
      lastErr = res.error || res.data?.error || "resolve_failed";
    } catch (e) {
      lastErr = e;
    }
  }
  if (!data) throw new Error(typeof lastErr === "string" ? lastErr : (lastErr?.message || "resolve_failed"));
  // 🔧 `data.qualities` YA viene normalizado desde el edge como [{label,url}].
  // No re-normalizar (eso lo vaciaba y rompía el selector de calidades).
  const rawQualities = data.qualities;
  const qualities: SeekeQuality[] = Array.isArray(rawQualities)
    ? rawQualities.filter((q: any) => q && typeof q.url === "string" && q.url).map((q: any) => ({ label: String(q.label || ""), url: String(q.url) }))
    : normalizeSeekeQualities(rawQualities);
  return {
    embed: String(data.embed),
    episode: Number(data.episode || ep),
    cached: !!data.cached,
    subtitles: normalizeSeekeSubs(data.subtitles),
    latest_episode: Number.isFinite(Number(data.latest_episode)) ? Number(data.latest_episode) : undefined,
    qualities,
  };
}

export async function resolveStreamLatest(
  anilistId: number,
  lang: string
): Promise<number | undefined> {
  for (const timeout of [6000, 12000]) {
    try {
      const res = await invokeWithTimeout({ action: "latest", anilistId, lang, ep: 1 }, timeout);
      if (res.error || !res.data?.ok) continue;
      const latest = Number(res.data?.latest_episode);
      if (Number.isFinite(latest)) return latest;
    } catch { /* retry */ }
  }
  return undefined;
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
      .from("slugs")
      .select("slug, manual_slug")
      .eq("anilist_id", anilistId)
      .maybeSingle();
    // Prioridad: override manual > cache automático
    const effective = data?.manual_slug || data?.slug || null;
    if (effective) {
      slugMemoryCache.set(`id-${anilistId}`, effective);
      return effective;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveCachedSlug(anilistId: number, slug: string, title: string): Promise<void> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    await supabase.from("slugs").upsert(
      { anilist_id: anilistId, slug, title } as any,
      { onConflict: "anilist_id" }
    );
    slugMemoryCache.set(`id-${anilistId}`, slug);
  } catch {
    // Silently fail - cache is optional
  }
}

// HLS Latino R2 eliminado. Solo operamos con enlaces Seeke.

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
