// Registro persistente de animes marcados como `isAdult` en AniList.
// Regla del proyecto: NO aparecen en ninguna parte del admin (pendientes,
// reserva, relacionados) ni en el Home; sólo se pueden gestionar desde la
// búsqueda de la sección Videos y, una vez aprobados (Seeke o slug), aparecen
// únicamente en la búsqueda pública.
import { supabase } from "@/integrations/supabase/client";

const ANILIST_URL = "https://graphql.anilist.co";

let memCache: Set<number> | null = null;
let inflight: Promise<Set<number>> | null = null;
const checked = new Set<number>(); // ids ya consultados en esta sesión

export async function getAdultAnimeIds(force = false): Promise<Set<number>> {
  if (!force && memCache) return memCache;
  if (!force && inflight) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase
      .from("adult_animes" as any)
      .select("anilist_id")
      .limit(5000);
    if (error) {
      console.error("[adult-animes] load error", error);
      return memCache ?? new Set<number>();
    }
    const set = new Set<number>((data || []).map((r: any) => r.anilist_id as number));
    set.forEach((id) => checked.add(id));
    memCache = set;
    return set;
  })();
  const res = await inflight;
  inflight = null;
  return res;
}

export function isKnownAdult(id: number): boolean {
  return memCache?.has(id) ?? false;
}

async function fetchAdultFlags(ids: number[]): Promise<{ id: number; title: string }[]> {
  const out: { id: number; title: string }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    try {
      const res = await fetch(ANILIST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id isAdult title{romaji english}}}}`,
          variables: { ids: slice },
        }),
      });
      if (!res.ok) continue;
      const json = await res.json();
      for (const m of json?.data?.Page?.media || []) {
        if (m?.isAdult === true) {
          out.push({ id: m.id, title: m.title?.romaji || m.title?.english || `Anime #${m.id}` });
        }
      }
    } catch {
      /* red caída: se reintenta en la próxima carga */
    }
  }
  return out;
}

/**
 * Detecta ids adultos aún desconocidos, los persiste y limpia la reserva de
 * pendientes. Devuelve el set actualizado (para filtrar en caliente).
 */
export async function detectAndFlagAdult(ids: number[]): Promise<Set<number>> {
  const known = await getAdultAnimeIds();
  const unknown = ids.filter((id) => id && !checked.has(id));
  if (!unknown.length) return known;
  unknown.forEach((id) => checked.add(id));

  const found = await fetchAdultFlags(unknown);
  if (!found.length) return known;

  await supabase.from("adult_animes" as any).upsert(
    found.map((f) => ({ anilist_id: f.id, title: f.title })),
    { onConflict: "anilist_id" },
  );

  const adultIds = found.map((f) => f.id);
  // Saca de la reserva de pendientes cualquier adulto que se hubiera colado.
  await supabase.from("pending_anime_reserve" as any).delete().in("anilist_id", adultIds);

  adultIds.forEach((id) => known.add(id));
  memCache = known;
  return known;
}

/** Filtra cualquier lista de objetos con `id` quitando los adultos conocidos. */
export function stripAdult<T extends { id: number }>(list: T[], adult: Set<number>): T[] {
  return list.filter((x) => !adult.has(x.id));
}
