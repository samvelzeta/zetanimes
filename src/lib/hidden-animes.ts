// Cache de animes ocultos del Home
import { supabase } from "@/integrations/supabase/client";

let cache: Set<number> | null = null;
let loading: Promise<Set<number>> | null = null;

export async function getHiddenAnimeIds(): Promise<Set<number>> {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    const { data } = await supabase.from("hidden_home_animes").select("anilist_id");
    cache = new Set((data || []).map((r: any) => r.anilist_id));
    return cache;
  })();
  return loading;
}

export function clearHiddenCache() {
  cache = null;
  loading = null;
}

export async function hideAnime(anilist_id: number, anime_title: string, hidden_by?: string) {
  const { error } = await supabase.from("hidden_home_animes").insert({
    anilist_id, anime_title, hidden_by: hidden_by ?? null,
  });
  clearHiddenCache();
  return !error;
}

export async function unhideAnime(anilist_id: number) {
  const { error } = await supabase.from("hidden_home_animes").delete().eq("anilist_id", anilist_id);
  clearHiddenCache();
  return !error;
}

export async function listHiddenAnimes() {
  const { data } = await supabase
    .from("hidden_home_animes")
    .select("*")
    .order("created_at", { ascending: false });
  return data || [];
}

/** Filtra una lista de animes excluyendo los ocultos */
export async function filterHidden<T extends { id: number }>(animes: T[]): Promise<T[]> {
  const hidden = await getHiddenAnimeIds();
  if (!hidden.size) return animes;
  return animes.filter((a) => !hidden.has(a.id));
}
