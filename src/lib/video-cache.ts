// Cache global de videos en Lovable Cloud (Supabase)
// Animes con <12 eps se priorizan aquí; resto deja que Cloudflare cachee
import { supabase } from "@/integrations/supabase/client";

export interface VideoSources {
  hls?: string[];
  mp4?: string[];
  embed?: string[];
  pc?: string[];
  mobile?: string[];
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

const memCache = new Map<string, CachedVideo | null>();

function normalizeSlug(slug: string) {
  return slug.trim().toLowerCase();
}

function cacheKey(slug: string, ep: number, lang: string) {
  return `${normalizeSlug(slug)}::${ep}::${lang}`;
}

function animeCacheKey(anilistId: number, ep: number, lang: string) {
  return `anilist:${anilistId}::${ep}::${lang}`;
}

function writeCache(video: CachedVideo | null, slug: string, ep: number, lang: string, anilistId?: number | null) {
  memCache.set(cacheKey(slug, ep, lang), video);
  if (anilistId) {
    memCache.set(animeCacheKey(anilistId, ep, lang), video);
  }
}

function clearCache(slug: string, ep: number, lang: string, anilistId?: number | null) {
  memCache.delete(cacheKey(slug, ep, lang));
  if (anilistId) {
    memCache.delete(animeCacheKey(anilistId, ep, lang));
  }
}

function pickBestVideo(rows: CachedVideo[], requestedSlug: string) {
  const normalizedSlug = normalizeSlug(requestedSlug);
  return rows.find((row) => normalizeSlug(row.slug) === normalizedSlug) || rows[0] || null;
}

/**
 * Busca primero en el cache global (DB). Devuelve null si no existe.
 */
export async function getCachedVideo(
  slug: string,
  episode: number,
  lang: string,
  anilistId?: number
): Promise<CachedVideo | null> {
  const normalizedSlug = normalizeSlug(slug);
  const slugKey = cacheKey(normalizedSlug, episode, lang);
  const byAnimeKey = anilistId ? animeCacheKey(anilistId, episode, lang) : null;

  if (byAnimeKey && memCache.has(byAnimeKey)) return memCache.get(byAnimeKey)!;
  if (memCache.has(slugKey)) return memCache.get(slugKey)!;

  let rows: CachedVideo[] = [];

  if (anilistId) {
    const { data, error } = await supabase
      .from("video_cache")
      .select("*")
      .eq("anilist_id", anilistId)
      .eq("episode", episode)
      .eq("lang", lang)
      .order("updated_at", { ascending: false });

    if (!error && data?.length) {
      rows = data as unknown as CachedVideo[];
    }
  }

  if (!rows.length) {
    const { data, error } = await supabase
      .from("video_cache")
      .select("*")
      .eq("slug", normalizedSlug)
      .eq("episode", episode)
      .eq("lang", lang)
      .order("updated_at", { ascending: false });

    if (!error && data?.length) {
      rows = data as unknown as CachedVideo[];
    }
  }

  const result = pickBestVideo(rows, normalizedSlug);
  if (!result) {
    writeCache(null, normalizedSlug, episode, lang, anilistId);
    return null;
  }

  writeCache(result, normalizedSlug, episode, lang, anilistId ?? result.anilist_id);
  if (normalizeSlug(result.slug) !== normalizedSlug) {
    writeCache(result, result.slug, episode, lang, anilistId ?? result.anilist_id);
  }
  return result;
}

/**
 * Guarda/actualiza un video en el cache global (admin).
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
  let error = null;

  if (anilist_id) {
    const { data: existingRows, error: existingError } = await supabase
      .from("video_cache")
      .select("id, slug")
      .eq("anilist_id", anilist_id)
      .eq("episode", episode)
      .eq("lang", lang)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingError) {
      return { success: false, error: existingError.message };
    }

    const existing = existingRows?.[0];
    previousSlug = existing?.slug ?? null;

    if (existing?.id) {
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
        );

      error = response.error;
    }
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
  clearCache(slug, episode, lang, anilist_id);
  if (previousSlug && normalizeSlug(previousSlug) !== slug) {
    clearCache(previousSlug, episode, lang, anilist_id);
  }
  return { success: true };
}

/**
 * Elimina del cache. Devuelve { success, error } para diagnosticar fallos RLS.
 */
export async function deleteCachedVideo(
  slug: string,
  episode: number,
  lang: string,
  id?: string
): Promise<{ success: boolean; error?: string }> {
  const normalizedSlug = normalizeSlug(slug);
  let query = supabase.from("video_cache").delete().select("slug, anilist_id");

  if (id) {
    query = query.eq("id", id);
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

  return { success: true };
}

/**
 * Lista todos los videos guardados de un slug (admin).
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

/**
 * Convierte el cache a formato compatible con AnimePlayer sources.
 */
export function cachedVideoToSources(cached: CachedVideo): { name: string; embed: string; type?: string }[] {
  const out: { name: string; embed: string; type?: string }[] = [];
  const { hls = [], mp4 = [], embed = [], pc = [], mobile = [] } = cached.sources || {};
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  (isMobile ? mobile : pc).forEach((url, i) => out.push({ name: `${isMobile ? "Mobile" : "PC"} Cache ${i + 1}`, embed: url }));

  hls.forEach((url, i) => out.push({ name: `HLS Cache ${i + 1}`, embed: url, type: "hls" }));
  mp4.forEach((url, i) => out.push({ name: `MP4 Cache ${i + 1}`, embed: url, type: "mp4" }));
  embed.forEach((url, i) => out.push({ name: `Embed Cache ${i + 1}`, embed: url }));

  return out;
}
