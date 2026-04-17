// Cache global de videos en Lovable Cloud (Supabase)
// Animes con <12 eps se priorizan aquí; resto deja que Cloudflare cachee
import { supabase } from "@/integrations/supabase/client";

export interface VideoSources {
  hls?: string[];
  mp4?: string[];
  embed?: string[];
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

function cacheKey(slug: string, ep: number, lang: string) {
  return `${slug}::${ep}::${lang}`;
}

/**
 * Busca primero en el cache global (DB). Devuelve null si no existe.
 */
export async function getCachedVideo(
  slug: string,
  episode: number,
  lang: string
): Promise<CachedVideo | null> {
  const key = cacheKey(slug, episode, lang);
  if (memCache.has(key)) return memCache.get(key)!;

  const { data, error } = await supabase
    .from("video_cache")
    .select("*")
    .eq("slug", slug)
    .eq("episode", episode)
    .eq("lang", lang)
    .maybeSingle();

  if (error || !data) {
    memCache.set(key, null);
    return null;
  }

  const result = data as unknown as CachedVideo;
  memCache.set(key, result);
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
  const { slug, episode, lang, sources, anilist_id, anime_title, uploaded_by } = params;

  const { error } = await supabase
    .from("video_cache")
    .upsert(
      {
        slug,
        episode,
        lang,
        sources: sources as any,
        anilist_id: anilist_id ?? null,
        anime_title: anime_title ?? null,
        uploaded_by: uploaded_by ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "slug,episode,lang" }
    );

  if (error) return { success: false, error: error.message };
  memCache.delete(cacheKey(slug, episode, lang));
  return { success: true };
}

/**
 * Elimina del cache.
 */
export async function deleteCachedVideo(slug: string, episode: number, lang: string) {
  const { error } = await supabase
    .from("video_cache")
    .delete()
    .eq("slug", slug)
    .eq("episode", episode)
    .eq("lang", lang);
  memCache.delete(cacheKey(slug, episode, lang));
  return !error;
}

/**
 * Lista todos los videos guardados de un slug (admin).
 */
export async function listCachedVideosBySlug(slug: string): Promise<CachedVideo[]> {
  const { data } = await supabase
    .from("video_cache")
    .select("*")
    .eq("slug", slug)
    .order("episode", { ascending: true });
  return (data as unknown as CachedVideo[]) || [];
}

/**
 * Convierte el cache a formato compatible con AnimePlayer sources.
 */
export function cachedVideoToSources(cached: CachedVideo): { name: string; embed: string; type?: string }[] {
  const out: { name: string; embed: string; type?: string }[] = [];
  const { hls = [], mp4 = [], embed = [] } = cached.sources || {};

  hls.forEach((url, i) => out.push({ name: `HLS Cache ${i + 1}`, embed: url, type: "hls" }));
  mp4.forEach((url, i) => out.push({ name: `MP4 Cache ${i + 1}`, embed: url, type: "mp4" }));
  embed.forEach((url, i) => out.push({ name: `Embed Cache ${i + 1}`, embed: url }));

  return out;
}
