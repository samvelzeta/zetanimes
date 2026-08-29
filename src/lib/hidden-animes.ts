// Cache de animes ocultos del Home
import { supabase } from "@/integrations/supabase/client";
import { getVisibility, invalidateVisibility } from "@/lib/visibility-manifest";

export async function getHiddenAnimeIds(): Promise<Set<number>> {
  return (await getVisibility()).hidden;
}

export function clearHiddenCache() {
  invalidateVisibility().catch(() => {});
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
