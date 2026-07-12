// Catálogo oficial de enlaces de reproducción en Lovable Cloud.
// No se cachea en cliente: cada lectura consulta la base de datos oficial.
import { supabase } from "@/integrations/supabase/client";

export interface VideoSources {
  hls?: string[];
  mp4?: string[];
  embed?: string[];
  pc?: string[];
  mobile?: string[];
  seeke?: string[];
}

export interface CachedVideo {
  id: string;
  slug: string;
  episode: number;
  lang: string;
  anilist_id: number | null;
  anime_title: string | null;
  sources: VideoSources;
  updated_at: string;
}

export type PlaybackPlatform = "pc" | "mobile";

const memCache = new Map<string, CachedVideo | null>();

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function cacheKey(slug: string, ep: number, lang: string) {
  return `official::${normalizeSlug(slug)}::${ep}::${lang}`;
}

function animeCacheKey(anilistId: number, ep: number, lang: string) {
  return `official::anilist:${anilistId}::${ep}::${lang}`;
}

function writeCache(video: CachedVideo | null, slug: string, ep: number, lang: string, anilistId?: number | null) {
  // Compatibilidad con llamadas existentes: intencionalmente no guarda nada.
}

function clearCache(slug: string, ep: number, lang: string, anilistId?: number | null) {
  memCache.delete(cacheKey(slug, ep, lang));
  if (anilistId) {
    memCache.delete(animeCacheKey(anilistId, ep, lang));
  }
}

function clearAnimeCache(slug?: string | null, anilistId?: number | null) {
  if (!slug && !anilistId) {
    memCache.clear();
    return;
  }
  const normalized = slug ? normalizeSlug(slug) : null;
  for (const key of Array.from(memCache.keys())) {
    if ((normalized && key.includes(`::${normalized}::`)) || (anilistId && key.includes(`::anilist:${anilistId}::`))) {
      memCache.delete(key);
    }
  }
}

// ── Realtime cross-tab invalidation ─────────────────────────────────────────
// Cuando un admin guarda/elimina un video, todas las pestañas y dispositivos
// abiertos en la app deben tirar su memCache para releer la fila nueva.
type InvalidationPayload = {
  slug?: string | null;
  episode?: number | null;
  lang?: string | null;
  anilist_id?: number | null;
};

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

function applyInvalidation(p: InvalidationPayload) {
  if (p.slug && typeof p.episode === "number" && p.lang) {
    clearCache(p.slug, p.episode, p.lang, p.anilist_id ?? undefined);
  } else {
    // Datos incompletos: limpia todo el memCache para forzar relectura.
    memCache.clear();
  }
}

function ensureRealtimeChannel() {
  if (realtimeChannel || typeof window === "undefined") return;
  try {
    realtimeChannel = supabase
      .channel("video-cache-invalidation")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_cache" },
        (payload: any) => {
          const row = (payload.new ?? payload.old) || {};
          applyInvalidation({
            slug: row.slug ?? null,
            episode: row.episode ?? null,
            lang: row.lang ?? null,
            anilist_id: row.anilist_id ?? null,
          });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn("[video-cache] realtime subscribe failed:", err);
  }
}

function broadcastInvalidation(p: InvalidationPayload) {
  applyInvalidation(p);
  // El INSERT/UPDATE/DELETE en video_cache ya dispara postgres_changes, que llega
  // a todas las pestañas suscritas — no necesitamos un canal broadcast aparte.
}

if (typeof window !== "undefined") {
  // Auto-suscribir al cargar el módulo.
  setTimeout(ensureRealtimeChannel, 0);
}


function pickBestVideo(rows: CachedVideo[], requestedSlug: string) {
  const normalizedSlug = normalizeSlug(requestedSlug);
  return rows.find((row) => normalizeSlug(row.slug) === normalizedSlug) || rows[0] || null;
}

function hasSeekeSources(video: CachedVideo | null | undefined) {
  return (video?.sources?.seeke?.length || 0) > 0;
}

/**
 * Busca primero en el catálogo oficial de reproducción (DB). Devuelve null si no existe.
 */
export async function getCachedVideo(
  slug: string,
  episode: number,
  lang: string,
  anilistId?: number
): Promise<CachedVideo | null> {
  const normalizedSlug = normalizeSlug(slug);

  let rows: CachedVideo[] = [];

  const readRows = async (targetEpisode: number): Promise<CachedVideo[]> => {
    if (anilistId) {
      const { data, error } = await supabase
        .from("video_cache")
        .select("*")
        .eq("anilist_id", anilistId)
        .eq("episode", targetEpisode)
        .eq("lang", lang)
        .order("updated_at", { ascending: false });

      if (!error && data?.length) return data as unknown as CachedVideo[];
    }

    const { data, error } = await supabase
      .from("video_cache")
      .select("*")
      .eq("slug", normalizedSlug)
      .eq("episode", targetEpisode)
      .eq("lang", lang)
      .order("updated_at", { ascending: false });

    return !error && data?.length ? data as unknown as CachedVideo[] : [];
  };

  // Seeke usa una URL base por anime/idioma; si existe, SIEMPRE gana sobre
  // cualquier HLS/embed viejo del capítulo (AV1/Zilla) que haya quedado en cache.
  if (episode !== 0) {
    const baseRows = await readRows(0);
    const seekeBase = pickBestVideo(baseRows.filter(hasSeekeSources), normalizedSlug);
    if (seekeBase) {
      return seekeBase;
    }
  }

  rows = await readRows(episode);
  if (!rows.length && episode !== 0) rows = await readRows(0);

  const result = pickBestVideo(rows, normalizedSlug);
  if (!result) {
    return null;
  }

  return result;
}

/**
 * Guarda/actualiza un enlace oficial de reproducción (admin).
 */
export async function saveCachedVideo(params: {
  slug: string;
  episode: number;
  lang: string;
  sources: VideoSources;
  anilist_id?: number;
  anime_title?: string;
  uploaded_by?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { episode, lang, sources, anilist_id, anime_title, uploaded_by } = params;
  const slug = normalizeSlug(params.slug);

  let previousSlug: string | null = null;
  let keepId: string | null = null;
  let error = null;

  if (anilist_id) {
    // Trae TODAS las filas existentes para (anilist_id, episode, lang) — no solo la más reciente.
    // Esto permite borrar duplicados/legacy con slug viejo que estaban sirviendo el video antiguo.
    const { data: existingRows, error: existingError } = await supabase
      .from("video_cache")
      .select("id, slug")
      .eq("anilist_id", anilist_id)
      .eq("episode", episode)
      .eq("lang", lang)
      .order("updated_at", { ascending: false });

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    const existing = existingRows?.[0];
    previousSlug = existing?.slug ?? null;

    if (existing?.id) {
      keepId = existing.id;
      const response = await supabase
        .from("video_cache")
        .update({
          slug,
          sources: sources as any,
          anilist_id,
          anime_title: anime_title ?? null,
          uploaded_by: uploaded_by ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      error = response.error;
    } else {
      const response = await supabase
        .from("video_cache")
        .upsert(
          {
            slug,
            episode,
            lang,
            sources: sources as any,
            anilist_id,
            anime_title: anime_title ?? null,
            uploaded_by: uploaded_by ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "slug,episode,lang" }
        )
        .select("id")
        .single();

      error = response.error;
      keepId = response.data?.id ?? null;
    }

    // Wipe TOTAL: elimina cualquier otra fila para (anilist_id, episode, lang)
    // — slugs viejos, duplicados, embeds previos. Garantiza que el nuevo enlace
    // sea el único que pueda servir ese episodio.
    if (!error && episode !== 0) {
      const wipe = supabase
        .from("video_cache")
        .delete()
        .eq("anilist_id", anilist_id)
        .eq("episode", episode)
        .eq("lang", lang)
        .is("sources->seeke", null);
      if (keepId) wipe.neq("id", keepId);
      const { error: wipeErr } = await wipe;
      if (wipeErr) console.warn("[video-cache] wipe duplicates failed:", wipeErr);
    }

    // Los SEEKE BASE (episode 0) son enlaces madre protegidos: se actualizan
    // por id/upsert, pero jamás se limpian con delete automático.
  } else {
    const response = await supabase
      .from("video_cache")
      .upsert(
        {
          slug,
          episode,
          lang,
          sources: sources as any,
          anilist_id: null,
          anime_title: anime_title ?? null,
          uploaded_by: uploaded_by ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug,episode,lang" }
      );

    error = response.error;
  }

  if (error) return { success: false, error: error.message };
  // Invalida memCache local + notifica a TODAS las pestañas/dispositivos vía realtime.
  clearCache(slug, episode, lang, anilist_id);
  if (previousSlug && normalizeSlug(previousSlug) !== slug) {
    clearCache(previousSlug, episode, lang, anilist_id);
  }
  broadcastInvalidation({ slug, episode, lang, anilist_id: anilist_id ?? null });
  return { success: true };
}


/**
 * Elimina un enlace oficial. Devuelve { success, error } para diagnosticar fallos RLS.
 */
export async function deleteCachedVideo(
  slug: string,
  episode: number,
  lang: string,
  id?: string,
  anilistId?: number
): Promise<{ success: boolean; error?: string }> {
  if (episode === 0) {
    return { success: false, error: "El enlace madre Seeke está protegido y no se puede eliminar." };
  }

  const normalizedSlug = normalizeSlug(slug);
  let query = supabase.from("video_cache").delete().select("slug, anilist_id");

  if (id) {
    query = query.eq("id", id);
  } else if (anilistId) {
    query = query.eq("anilist_id", anilistId).eq("episode", episode).eq("lang", lang);
  } else {
    query = query.eq("slug", normalizedSlug).eq("episode", episode).eq("lang", lang);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[video-cache] delete error:", error);
    return { success: false, error: error.message };
  }

  (data || []).forEach((row) => {
    clearCache(row.slug || normalizedSlug, episode, lang, row.anilist_id);
  });
  clearCache(normalizedSlug, episode, lang, anilistId);
  broadcastInvalidation({ slug: normalizedSlug, episode, lang, anilist_id: anilistId ?? null });

  return { success: true };
}

export async function deleteEpisodeVideoCache(params: {
  slug: string;
  episode: number;
  anilistId?: number;
}): Promise<{ success: boolean; error?: string; count?: number }> {
  if (params.episode === 0) {
    return { success: false, error: "El enlace madre Seeke está protegido y no se puede eliminar.", count: 0 };
  }

  const normalizedSlug = normalizeSlug(params.slug);
  let query = supabase.from("video_cache").delete({ count: "exact" }).select("slug, episode, lang, anilist_id");
  query = params.anilistId
    ? query.eq("episode", params.episode).or(`anilist_id.eq.${params.anilistId},slug.eq.${normalizedSlug}`)
    : query.eq("slug", normalizedSlug).eq("episode", params.episode);

  const { data, error, count } = await query;
  if (error) return { success: false, error: error.message };
  (data || []).forEach((row: any) => clearCache(row.slug || normalizedSlug, row.episode, row.lang, row.anilist_id));
  clearAnimeCache(normalizedSlug, params.anilistId);
  broadcastInvalidation({ slug: normalizedSlug, episode: params.episode, lang: null, anilist_id: params.anilistId ?? null });
  return { success: true, count: count ?? data?.length ?? 0 };
}

export async function deleteAnimeVideoCache(params: {
  slug: string;
  anilistId?: number;
}): Promise<{ success: boolean; error?: string; count?: number }> {
  const normalizedSlug = normalizeSlug(params.slug);
  let query = supabase.from("video_cache").delete({ count: "exact" }).select("slug, episode, lang, anilist_id");
  query = params.anilistId ? query.or(`anilist_id.eq.${params.anilistId},slug.eq.${normalizedSlug}`) : query.eq("slug", normalizedSlug);
  query = query.neq("episode", 0);
  query = query.is("sources->seeke", null);

  const { data, error, count } = await query;
  if (error) return { success: false, error: error.message };
  clearAnimeCache(normalizedSlug, params.anilistId);
  (data || []).forEach((row: any) => broadcastInvalidation({ slug: row.slug || normalizedSlug, episode: row.episode, lang: row.lang, anilist_id: row.anilist_id }));
  if (!data?.length) broadcastInvalidation({ slug: normalizedSlug, episode: null, lang: null, anilist_id: params.anilistId ?? null });
  return { success: true, count: count ?? data?.length ?? 0 };
}

export async function deleteAllVideoCache(): Promise<{ success: boolean; error?: string; count?: number }> {
  const { data, error, count } = await supabase
    .from("video_cache")
    .delete({ count: "exact" })
    .neq("episode", 0)
    .is("sources->seeke", null)
    .neq("id", "00000000-0000-0000-0000-000000000000")
    .select("slug, episode, lang, anilist_id");
  if (error) return { success: false, error: error.message };
  memCache.clear();
  broadcastInvalidation({ slug: null, episode: null, lang: null, anilist_id: null });
  return { success: true, count: count ?? data?.length ?? 0 };
}

/**
 * Lista todos los enlaces oficiales guardados de un slug (admin).
 */
export async function listCachedVideosBySlug(slug: string, anilistId?: number): Promise<CachedVideo[]> {
  const normalizedSlug = normalizeSlug(slug);
  const merged = new Map<string, CachedVideo>();

  if (anilistId) {
    const { data } = await supabase
      .from("video_cache")
      .select("*")
      .eq("anilist_id", anilistId)
      .order("episode", { ascending: true })
      .order("updated_at", { ascending: false });

    ((data as unknown as CachedVideo[]) || []).forEach((video) => {
      merged.set(video.id, video);
    });
  }

  const { data } = await supabase
    .from("video_cache")
    .select("*")
    .eq("slug", normalizedSlug)
    .order("episode", { ascending: true })
    .order("updated_at", { ascending: false });

  ((data as unknown as CachedVideo[]) || []).forEach((video) => {
    merged.set(video.id, video);
  });

  return Array.from(merged.values()).sort((a, b) => {
    if (a.episode !== b.episode) return a.episode - b.episode;
    return a.lang.localeCompare(b.lang);
  });
}

export function clearRuntimeVideoCache() {
  memCache.clear();
}

/**
 * Convierte el registro oficial a formato compatible con AnimePlayer sources.
 */
export function cachedVideoToSources(cached: CachedVideo): { name: string; embed: string; type?: string }[] {
  const out: { name: string; embed: string; type?: string }[] = [];
  const { hls = [], mp4 = [], embed = [], pc = [], mobile = [], seeke = [] } = cached.sources || {};
  const platform = getPlaybackPlatform();

  // Primero van las fuentes universales: principal y fallback deben probarse antes
  // de caer en enlaces específicos de PC/APK.
  seeke.forEach((url, i) => out.push({ name: `Seeke Base ${i + 1}`, embed: url, type: "seeke" }));
  hls.forEach((url, i) => out.push({ name: `HLS Oficial ${i + 1}`, embed: url, type: "hls" }));
  mp4.forEach((url, i) => out.push({ name: `MP4 Oficial ${i + 1}`, embed: url, type: "mp4" }));
  embed.forEach((url, i) => out.push({ name: `Embed Oficial ${i + 1}`, embed: url }));

  const preferred = platform === "mobile" ? mobile : pc;
  const secondary = platform === "mobile" ? pc : mobile;
  preferred.forEach((url, i) => out.push({ name: `${platform === "mobile" ? "APK/Móvil" : "PC"} Oficial ${i + 1}`, embed: url }));
  secondary.forEach((url, i) => out.push({ name: `${platform === "mobile" ? "PC" : "APK/Móvil"} Oficial ${i + 1}`, embed: url }));

  return out;
}

export function getPlaybackPlatform(): PlaybackPlatform {
  const ua = navigator.userAgent;
  const isWebView = /wv|; wv\)/i.test(ua) || (window as any).AndroidWebView !== undefined;
  return isWebView || /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "pc";
}
