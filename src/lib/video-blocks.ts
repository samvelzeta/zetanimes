// Sistema de "Animes en bloques": permite mapear rangos de episodios a URLs
// madre Seeke distintas (útil cuando una serie está dividida por temporadas
// en la fuente externa pero en mi página tiene numeración continua).
import { supabase } from "@/integrations/supabase/client";
import { getLatestEpisodeForBase, resolveStreamLatest } from "@/lib/zetapi";

export interface VideoBlock {
  id: string;
  anilist_id: number;
  slug: string;
  lang: string; // 'sub' | 'latino'
  block_index: number;
  block_label: string | null;
  episode_from: number;
  episode_to: number;
  /** ⚠️ Solo lo llena el panel admin. En el flujo público es "". */
  seeke_base_url: string;
  /** Si > 0, modo inverso: el episodio relativo al bloque se desplaza por este valor
   *  cuando se construye la petición a la VPS.
   *  Ej. página ep 1, offset 24 → se pide a Seeke como ep 25. */
  source_episode_offset?: number;
  inverse_mode?: boolean;
}

export interface ResolvedBlock {
  /** ⚠️ Solo se completa en el panel admin. En el player público es "". */
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
  /** Variante usada (1..N) cuando el mismo episodio cae en varios bloques solapados. */
  variant: number;
}

export async function listBlocks(anilistId: number, lang: string): Promise<VideoBlock[]> {
  // Flujo público: RPC que NO devuelve seeke_base_url. La URL madre solo la
  // conoce el edge function `resolve-stream` server-side.
  const { data, error } = await supabase.rpc("list_video_blocks_public", {
    _anilist_id: anilistId,
    _lang: lang,
  });

  if (error) {
    console.warn("[video-blocks] listBlocks error:", error);
    return [];
  }
  return ((data as any[]) || []).map((b) => ({
    id: b.id,
    anilist_id: b.anilist_id,
    slug: b.slug,
    lang: b.lang,
    block_index: b.block_index,
    block_label: b.block_label,
    episode_from: b.episode_from,
    episode_to: b.episode_to,
    seeke_base_url: "", // enmascarado
    source_episode_offset: b.source_episode_offset,
    inverse_mode: b.inverse_mode,
  }));
}

export function invalidateBlocksCache(anilistId?: number, lang?: string) {
  // No-op legacy: los bloques se leen siempre directo de la base oficial.
}


/**
 * Si hay bloques definidos para (anilistId, lang) devuelve el bloque al que
 * pertenece `episode` (con su URL madre y el episodio relativo dentro del
 * bloque). Devuelve null si no hay bloques o el episodio cae fuera de rango.
 */
export async function resolveSeekeBaseForEpisode(
  anilistId: number,
  lang: string,
  episode: number,
  variant: number = 1
): Promise<ResolvedBlock | null> {
  const blocks = await listBlocks(anilistId, lang);
  if (!blocks.length) return null;
  // Todos los bloques que cubren este episodio (ordenados por block_index).
  const matches = blocks
    .filter((b) => episode >= b.episode_from && episode <= b.episode_to)
    .sort((a, b) => a.block_index - b.block_index);
  if (!matches.length) return null;
  const idx = Math.max(1, variant) - 1;
  const match = matches[idx] || matches[matches.length - 1];
  const offset = Number(match.source_episode_offset || 0);
  const relative = episode - match.episode_from + 1; // 1-indexed within block
  const episodeWithinBlock = relative + offset;
  return {
    // Placeholder opaco — la URL real solo la conoce el edge function server-side.
    // Debe ser único por bloque para no colapsar en deduplicaciones del player.
    baseUrl: `__masked_block_${match.block_index}__`,
    blockIndex: match.block_index,
    blockLabel: match.block_label,
    episodeFrom: match.episode_from,
    episodeTo: match.episode_to,
    episodeWithinBlock,
    sourceEpisodeOffset: offset,
    inverseMode: !!match.inverse_mode || offset > 0,
    variant: Math.min(idx + 1, matches.length),
  };
}

/**
 * Construye la lista lineal de "slots" de episodios teniendo en cuenta bloques
 * solapados. Si un mismo número de episodio está en 2 bloques, se generan 2
 * slots (variant 1 y 2). Sin bloques → 1 slot por episodio del 1..maxEp.
 */
export interface EpisodeSlot {
  ep: number;
  variant: number;
  blockIndex?: number;
  blockLabel?: string | null;
}

export function buildEpisodeSlots(
  blocks: VideoBlock[],
  maxEp: number
): EpisodeSlot[] {
  const slots: EpisodeSlot[] = [];
  if (maxEp <= 0) return slots;
  const sortedBlocks = [...blocks].sort((a, b) => a.block_index - b.block_index);
  for (let ep = 1; ep <= maxEp; ep++) {
    const matches = sortedBlocks.filter((b) => ep >= b.episode_from && ep <= b.episode_to);
    if (matches.length === 0) {
      slots.push({ ep, variant: 1 });
    } else {
      matches.forEach((b, i) => {
        slots.push({
          ep,
          variant: i + 1,
          blockIndex: b.block_index,
          blockLabel: b.block_label,
        });
      });
    }
  }
  return slots;
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
  createdBy?: string,
  options?: { allowOverlap?: boolean }
): Promise<{ success: boolean; error?: string; overlap?: { a: number; b: number } }> {
  // Payload vacío = desactivar por completo: borrar todas las filas de (anilist_id, lang).
  if (!blocks.length) {
    const { error: delAllError } = await supabase
      .from("video_cache_blocks" as any)
      .delete()
      .eq("anilist_id", anilistId)
      .eq("lang", lang);
    invalidateBlocksCache(anilistId, lang);
    if (delAllError) return { success: false, error: delAllError.message };
    return { success: true };
  }

  // Ordenar y validar solapamientos
  const sorted = [...blocks].sort((a, b) => a.episode_from - b.episode_from);
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    if (!b.seeke_base_url.trim() || b.seeke_base_url.trim().startsWith("__masked")) {
      return { success: false, error: `Bloque ${i + 1}: URL inválida (vacía o placeholder). Pega la URL madre real de Seeke.` };
    }
    if (b.episode_from < 1 || b.episode_to < b.episode_from) {
      return { success: false, error: `Bloque ${i + 1}: rango inválido (${b.episode_from}–${b.episode_to})` };
    }
    if ((b.source_episode_offset || 0) < 0) {
      return { success: false, error: `Bloque ${i + 1}: offset negativo no permitido` };
    }
    if (i > 0 && b.episode_from <= sorted[i - 1].episode_to) {
      const prev = sorted[i - 1];
      const sameUrl = prev.seeke_base_url.trim().toLowerCase() === b.seeke_base_url.trim().toLowerCase();
      if (sameUrl) {
        return { success: false, error: `Bloques ${i} y ${i + 1} se solapan y apuntan al mismo enlace seeke. El solapamiento solo se permite si los enlaces son distintos.`, overlap: { a: i, b: i + 1 } };
      }
      if (!options?.allowOverlap) {
        return { success: false, error: `Bloques ${i} y ${i + 1} se solapan`, overlap: { a: i, b: i + 1 } };
      }
    }
  }

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

  const { error: insError } = await supabase
    .from("video_cache_blocks" as any)
    .upsert(rows as any, { onConflict: "anilist_id,lang,block_index" });
  invalidateBlocksCache(anilistId, lang);
  if (insError) return { success: false, error: insError.message };
  return { success: true };
}

/**
 * Latest_episode global por idioma. Delegado 100% al edge function seguro
 * — el navegador nunca ve la URL madre ni consulta la VPS directamente.
 */
export async function getLatestEpisodeByLang(
  anilistId: number,
  lang: string,
  _fallbackBaseUrl?: string
): Promise<number | undefined> {
  return resolveStreamLatest(anilistId, lang);
}

/**
 * Variante ADMIN: lee bloques con la URL madre real (requiere rol admin/owner).
 * Solo debe usarse desde paneles administrativos.
 */
export async function listBlocksAdmin(anilistId: number, lang: string): Promise<VideoBlock[]> {
  const { data, error } = await supabase
    .from("video_cache_blocks" as any)
    .select("*")
    .eq("anilist_id", anilistId)
    .eq("lang", lang)
    .order("block_index", { ascending: true });
  if (error) {
    console.warn("[video-blocks] listBlocksAdmin error:", error);
    return [];
  }
  return (data || []) as unknown as VideoBlock[];
}

