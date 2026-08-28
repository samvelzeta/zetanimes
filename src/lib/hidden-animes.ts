// Cache de animes ocultos del Home
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet, idbDelete } from "@/lib/idb-cache";

const IDB_KEY = "hidden_home_anime_ids";
const IDB_TTL = 15 * 60 * 1000;

let cache: Set<number> | null = null;
let loading: Promise<Set<number>> | null = null;

export async function getHiddenAnimeIds(): Promise<Set<number>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    const cached = await idbGet<number[]>(IDB_KEY);
    if (cached) {
      cache = new Set(cached);
      return cache;
    }
    const { data } = await supabase.from("hidden_home_animes").select("anilist_id").eq("is_hidden", true);
    const ids = (data || []).map((r: any) => r.anilist_id as number);
    cache = new Set(ids);
    idbSet(IDB_KEY, ids, IDB_TTL).catch(() => {});
    return cache;
  })();
  return loading;
}

export function clearHiddenCache() {
  cache = null;
  loading = null;
  idbDelete(IDB_KEY).catch(() => {});
}

export async function hideAnime(anilist_id: number, anime_title: string, hidden_by?: string) {
  const { error } = await supabase.from("hidden_home_animes").upsert({
    anilist_id, anime_title, hidden_by: hidden_by ?? null, is_hidden: true, source: "manual", auto_hidden: false,
  } as any, { onConflict: "anilist_id" });
  clearHiddenCache();
  return !error;
}

export async function unhideAnime(anilist_id: number) {
  const { error } = await supabase.from("hidden_home_animes").update({ is_hidden: false } as any).eq("anilist_id", anilist_id);
  clearHiddenCache();
  return !error;
}

export async function rehideAnime(anilist_id: number) {
  const { error } = await supabase.from("hidden_home_animes").update({ is_hidden: true } as any).eq("anilist_id", anilist_id);
  clearHiddenCache();
  return !error;
}

export async function listHiddenAnimes(includeVisible = false) {
  let query = supabase
    .from("hidden_home_animes")
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeVisible) query = query.eq("is_hidden", true);
  const { data } = await query;
  return data || [];
}

/** Filtra una lista de animes excluyendo los ocultos */
export async function filterHidden<T extends { id: number }>(animes: T[]): Promise<T[]> {
  const hidden = await getHiddenAnimeIds();
  if (!hidden.size) return animes;
  return animes.filter((a) => !hidden.has(a.id));
}
