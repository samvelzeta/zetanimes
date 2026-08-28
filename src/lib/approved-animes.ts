// Whitelist de animes en emisión aprobados para mostrarse en el Home.
// Los animes con status = "RELEASING" que NO estén aquí se filtran del Home.
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet, idbDelete } from "@/lib/idb-cache";

const IDB_KEY = "approved_anime_ids";
const IDB_TTL = 15 * 60 * 1000; // 15 min

let memCache: Set<number> | null = null;
let memPromise: Promise<Set<number>> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function onApprovedChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function getApprovedAnimeIds(force = false): Promise<Set<number>> {
  if (!force && memCache) return memCache;
  if (!force && memPromise) return memPromise;
  memPromise = (async () => {
    if (!force) {
      const cached = await idbGet<number[]>(IDB_KEY);
      if (cached) {
        memCache = new Set(cached);
        return memCache;
      }
    }
    const { data, error } = await supabase
      .from("approved_animes" as any)
      .select("anilist_id");
    if (error) {
      console.error("[approved-animes] load error", error);
      return new Set<number>();
    }
    const ids = (data || []).map((r: any) => r.anilist_id as number);
    const set = new Set<number>(ids);
    memCache = set;
    idbSet(IDB_KEY, ids, IDB_TTL).catch(() => {});
    return set;
  })();
  const result = await memPromise;
  memPromise = null;
  return result;
}

export async function isAnimeApproved(anilistId: number): Promise<boolean> {
  const set = await getApprovedAnimeIds();
  return set.has(anilistId);
}

export async function approveAnime(anilistId: number, notes?: string): Promise<{ success: boolean; error?: string }> {
  const { data: user } = await supabase.auth.getUser();
  const uid = user.user?.id;
  const { error } = await supabase
    .from("approved_animes" as any)
    .upsert({
      anilist_id: anilistId,
      approved_by: uid ?? null,
      notes: notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "anilist_id" });
  if (error) return { success: false, error: error.message };
  memCache?.add(anilistId);
  idbDelete(IDB_KEY).catch(() => {});
  notify();
  return { success: true };
}

export async function unapproveAnime(anilistId: number): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from("approved_animes" as any)
    .delete()
    .eq("anilist_id", anilistId);
  if (error) return { success: false, error: error.message };
  memCache?.delete(anilistId);
  idbDelete(IDB_KEY).catch(() => {});
  notify();
  return { success: true };
}

/** Filtra una lista de media de AniList: descarta los que están en RELEASING y NO están aprobados. */
export function filterApprovedReleasing<T extends { id: number; status?: string }>(
  list: T[] | undefined,
  approved: Set<number>
): T[] {
  if (!list) return [];
  return list.filter((a) => {
    if (a.status !== "RELEASING") return true;
    return approved.has(a.id);
  });
}

/**
 * Filtro estricto para el Home:
 * - Oculta cualquier anime en NOT_YET_RELEASED / CANCELLED (aún no salen).
 * - Para RELEASING y FINISHED: sólo se muestran si están aprobados o
 *   ya tienen enlace madre Seeke guardado. Los demás se ocultan (viajan a
 *   Pendientes de aprobación por su propio flujo).
 */
export function filterHomeVisible<T extends { id: number; status?: string; isFallback?: boolean }>(
  list: T[] | undefined,
  approved: Set<number>,
  seekeMaster: Set<number>,
  reserveHidden: Set<number> = new Set()
): T[] {
  if (!list) return [];
  return list.filter((a) => {
    if (a.isFallback) return true; // fallback externo (Jikan) no requiere aprobación
    if (a.status === "NOT_YET_RELEASED" || a.status === "CANCELLED") return false;
    if (reserveHidden.has(a.id) && a.status !== "RELEASING") return false;
    if (approved.has(a.id)) return true;
    if (seekeMaster.has(a.id)) return true;
    // Sin aprobación ni enlace madre → ocultar del Home
    return false;
  });
}

