// Sistema de "Animes en bloques": permite mapear rangos de episodios a URLs
// madre Seeke distintas (útil cuando una serie está dividida por temporadas
// en la fuente externa pero en mi página tiene numeración continua).
import { supabase } from "@/integrations/supabase/client";
import { getLatestEpisodeForBase } from "@/lib/zetapi";

export interface VideoBlock {
  id: string;
  anilist_id: number;
  slug: string;
  lang: string; // 'sub' | 'latino'
  block_index: number;
  block_label: string | null;
  episode_from: number;
  episode_to: number;
  seeke_base_url: string;
  /** Si > 0, modo inverso: el episodio relativo al bloque se desplaza por este valor
   *  cuando se construye la petición a la VPS.
   *  Ej. página ep 1, offset 24 → se pide a Seeke como ep 25. */
  source_episode_offset?: number;
  inverse_mode?: boolean;
}

export interface ResolvedBlock {
  baseUrl: string;
  blockIndex: number;
  blockLabel: string | null;
  episodeFrom: number;
  episodeTo: number;
  /** Episodio que se debe pedir a la VPS (ya con offset aplicado si inverso). */
  episodeWithinBlock: number;
  /** Offset usado (solo informativo). */
  sourceEpisodeOffset: number;
  inverseMode: boolean;
}

const blocksMemoryCache = new Map<string, { value: VideoBlock[]; expiresAt: number }>();

function key(anilistId: number, lang: string) {
  return `${anilistId}::${lang}`;
}

export async function listBlocks(anilistId: number, lang: string): Promise<VideoBlock[]> {
  const { data, error } = await supabase
    .from("video_cache_blocks" as any)
    .select("*")
    .eq("anilist_id", anilistId)
    .eq("lang", lang)
    .order("block_index", { ascending: true });

  if (error) {
    console.warn("[video-blocks] listBlocks error:", error);
    return [];
  }
  const value = (data || []) as unknown as VideoBlock[];
  return value;
}

export function invalidateBlocksCache(anilistId?: number, lang?: string) {
  if (anilistId && lang) blocksMemoryCache.delete(key(anilistId, lang));
  else blocksMemoryCache.clear();
}

/**
 * Si hay bloques definidos para (anilistId, lang) devuelve el bloque al que
 * pertenece `episode` (con su URL madre y el episodio relativo dentro del
 * bloque). Devuelve null si no hay bloques o el episodio cae fuera de rango.
 */
export async function resolveSeekeBaseForEpisode(
  anilistId: number,
  lang: string,
  episode: number
): Promise<ResolvedBlock | null> {
  const blocks = await listBlocks(anilistId, lang);
  if (!blocks.length) return null;
  const match = blocks.find((b) => episode >= b.episode_from && episode <= b.episode_to);
  if (!match) return null;
  const offset = Number(match.source_episode_offset || 0);
  const relative = episode - match.episode_from + 1; // 1-indexed within block
  const episodeWithinBlock = relative + offset;
  return {
    baseUrl: match.seeke_base_url,
    blockIndex: match.block_index,
    blockLabel: match.block_label,
    episodeFrom: match.episode_from,
    episodeTo: match.episode_to,
    episodeWithinBlock,
    sourceEpisodeOffset: offset,
    inverseMode: !!match.inverse_mode || offset > 0,
  };
}

/**
 * Reemplaza COMPLETAMENTE los bloques de (anilistId, lang) con los provistos.
 * Solo admin/owner por RLS.
 */
export async function saveBlocks(
  anilistId: number,
  slug: string,
  lang: string,
  blocks: Array<{ block_label?: string | null; episode_from: number; episode_to: number; seeke_base_url: string; source_episode_offset?: number; inverse_mode?: boolean }>,
  createdBy?: string
): Promise<{ success: boolean; error?: string }> {
  // Validar
  if (!blocks.length) {
    // Borrar todos
    const { error } = await supabase
      .from("video_cache_blocks" as any)
      .delete()
      .eq("anilist_id", anilistId)
      .eq("lang", lang);
    invalidateBlocksCache(anilistId, lang);
    return error ? { success: false, error: error.message } : { success: true };
  }

  // Ordenar y validar solapamientos
  const sorted = [...blocks].sort((a, b) => a.episode_from - b.episode_from);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (!b.seeke_base_url.trim()) return { success: false, error: `Bloque ${i + 1} sin URL` };
    if (b.episode_from < 1 || b.episode_to < b.episode_from) {
      return { success: false, error: `Bloque ${i + 1}: rango inválido (${b.episode_from}–${b.episode_to})` };
    }
    if ((b.source_episode_offset || 0) < 0) {
      return { success: false, error: `Bloque ${i + 1}: offset negativo no permitido` };
    }
    if (i > 0 && b.episode_from <= sorted[i - 1].episode_to) {
      return { success: false, error: `Bloques ${i} y ${i + 1} se solapan` };
    }
  }

  // Borrar e insertar atómicamente (RLS garantiza el actor)
  const { error: delError } = await supabase
    .from("video_cache_blocks" as any)
    .delete()
    .eq("anilist_id", anilistId)
    .eq("lang", lang);
  if (delError) return { success: false, error: delError.message };

  const rows = sorted.map((b, idx) => ({
    anilist_id: anilistId,
    slug,
    lang,
    block_index: idx + 1,
    block_label: b.block_label || null,
    episode_from: b.episode_from,
    episode_to: b.episode_to,
    seeke_base_url: b.seeke_base_url.trim(),
    source_episode_offset: Number(b.source_episode_offset || 0),
    inverse_mode: !!b.inverse_mode,
    created_by: createdBy || null,
  }));

  const { error: insError } = await supabase.from("video_cache_blocks" as any).insert(rows as any);
  invalidateBlocksCache(anilistId, lang);
  if (insError) return { success: false, error: insError.message };
  return { success: true };
}

/**
   * Latest_episode global por idioma.
   * - Sin bloques: usa la URL madre oficial guardada en DB (episode=0).
 * - Con bloques: pide a cada bloque su latest_episode y lo mapea a numeración
 *   global; devuelve el máximo absoluto.
 */
export async function getLatestEpisodeByLang(
  anilistId: number,
  lang: string,
  fallbackBaseUrl?: string
): Promise<number | undefined> {
  const blocks = await listBlocks(anilistId, lang);
  if (blocks.length) {
    const results = await Promise.all(
      blocks.map(async (b) => {
        const offset = Number(b.source_episode_offset || 0);
        // En modo inverso (offset>0), pedimos a partir del cap real en Seeke.
        const hint = Math.max(1, offset + 1);
        const latestWithin = await getLatestEpisodeForBase(b.seeke_base_url, hint);
        if (!latestWithin) return undefined;
        // latestWithin viene en numeración de Seeke. Restamos offset para obtener
        // el cap relativo al bloque, luego mapeamos a numeración global.
        const blockSize = b.episode_to - b.episode_from + 1;
        const relative = Math.max(0, latestWithin - offset); // cap visible dentro del bloque
        if (relative <= 0) return undefined;
        const clamped = Math.min(relative, blockSize);
        return b.episode_from + clamped - 1;
      })
    );
    const valid = results.filter((n): n is number => typeof n === "number" && n > 0);
    return valid.length ? Math.max(...valid) : undefined;
  }
  if (fallbackBaseUrl) return getLatestEpisodeForBase(fallbackBaseUrl, 1);
  return undefined;
}
