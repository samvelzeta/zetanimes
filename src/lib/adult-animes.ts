// Registro persistente de animes marcados como `isAdult` en AniList.
// Regla del proyecto: NO aparecen en ninguna parte del admin (pendientes,
// reserva, relacionados) ni en el Home; sólo se pueden gestionar desde la
// búsqueda de la sección Videos y, una vez aprobados (Seeke o slug), aparecen
// únicamente en la búsqueda pública.
import { supabase } from "@/integrations/supabase/client";
import { getVisibility, invalidateVisibility } from "@/lib/visibility-manifest";

const ANILIST_URL = "https://graphql.anilist.co";

let memCache: Set<number> | null = null;
let inflight: Promise<Set<number>> | null = null;
const checked = new Set<number>(); // ids ya consultados en esta sesión

export async function getAdultAnimeIds(force = false): Promise<Set<number>> {
  const sets = await getVisibility(force);
  memCache = sets.adult;
  memCache.forEach((id) => checked.add(id));
  return memCache;
}

export function isKnownAdult(id: number): boolean {
  return memCache?.has(id) ?? false;
}

async function fetchAdultFlags(ids: number[]): Promise<{ id: number; title: string }[]> {
  const out: { id: number; title: string }[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const slice = ids.slice(i, i + 50);
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      try {
        const res = await fetch(ANILIST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query($ids:[Int]){Page(page:1,perPage:50){media(id_in:$ids,type:ANIME){id isAdult title{romaji english}}}}`,
            variables: { ids: slice },
          }),
        });
        if (res.status === 429) {
          // Rate limit: esperamos y reintentamos; NO marcamos como revisados.
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) break;
        ok = true;
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
    // Sólo marcamos como revisados los ids de lotes que respondieron bien;
    // si falló, se reintentarán en la próxima pasada.
    if (ok) slice.forEach((id) => checked.add(id));
  }
  return out;
}

/**
 * Detecta ids adultos aún desconocidos, los persiste y limpia la reserva de
 * pendientes. Devuelve el set actualizado (para filtrar en caliente).
 */
export async function detectAndFlagAdult(ids: number[]): Promise<Set<number>> {
  const known = await getAdultAnimeIds();
  // Máx. 200 ids por pasada para no ahogar AniList; el resto se revisa en la
  // siguiente ejecución del efecto.
  const unknown = ids.filter((id) => id && !checked.has(id)).slice(0, 200);
  if (!unknown.length) return known;

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
