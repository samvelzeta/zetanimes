// Whitelist de animes en emisión aprobados para mostrarse en el Home.
// Los animes con status = "RELEASING" que NO estén aquí se filtran del Home.
import { supabase } from "@/integrations/supabase/client";

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
    const { data, error } = await supabase
      .from("approved_animes" as any)
      .select("anilist_id");
    if (error) {
      console.error("[approved-animes] load error", error);
      return new Set<number>();
    }
    const set = new Set<number>((data || []).map((r: any) => r.anilist_id as number));
    memCache = set;
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
