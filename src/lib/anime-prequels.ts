// Helpers para detectar temporadas anteriores (PREQUEL/PARENT) en AniList
// y saber cuáles ya tienen enlace madre Seeke en video_cache.
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet, idbDelete } from "@/lib/idb-cache";

const ANILIST_URL = "https://graphql.anilist.co";
const TTL = 24 * 60 * 60 * 1000; // 24h

export interface PrequelNode {
  id: number;
  title: string;
  cover: string;
  episodes: number | null;
  status: string | null;
  format: string | null;
}

const PREQUEL_TYPES = new Set(["PREQUEL", "PARENT"]);

/** Fetch un anime individual con relaciones directas. Cacheado 24h en IDB. */
async function fetchWithRelations(id: number): Promise<any | null> {
  const key = `prequel-rel:${id}`;
  const cached = await idbGet<any>(key);
  if (cached) return cached;
  try {
    const res = await fetch(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($id:Int){Media(id:$id,type:ANIME){id title{romaji english}coverImage{large}episodes status format relations{edges{relationType node{id type format title{romaji english}coverImage{large}episodes status isAdult}}}}}`,
        variables: { id },
      }),
    });
    const json = await res.json();
    const media = json?.data?.Media || null;
    if (media) idbSet(key, media, TTL);
    return media;
  } catch {
    return null;
  }
}

/**
 * Obtiene la cadena de precuelas (temporadas anteriores) del anime dado,
 * ordenada de más antigua a más reciente. Solo incluye TV / OVA / ONA / SPECIAL — descarta películas.
 */
export async function getPrequelChain(anilistId: number, maxDepth = 6): Promise<PrequelNode[]> {
  const visited = new Set<number>([anilistId]);
  const chain: PrequelNode[] = [];
  let currentId = anilistId;

  for (let i = 0; i < maxDepth; i++) {
    const media = await fetchWithRelations(currentId);
    if (!media) break;
    const edge = (media.relations?.edges || []).find(
      (e: any) =>
        PREQUEL_TYPES.has(e.relationType) &&
        e.node?.type === "ANIME" &&
        e.node?.format !== "MOVIE" &&
        !(e.node as any)?.isAdult &&
        !visited.has(e.node.id)
    );
    if (!edge) break;
    const n = edge.node;
    visited.add(n.id);
    chain.push({
      id: n.id,
      title: n.title?.english || n.title?.romaji || `Anime #${n.id}`,
      cover: n.coverImage?.large || "",
      episodes: n.episodes ?? null,
      status: n.status ?? null,
      format: n.format ?? null,
    });
    currentId = n.id;
  }

  return chain.reverse(); // más antigua primero
}

/**
 * Devuelve las side stories directas del anime (nodos ANIME no película).
 * No recorre en cadena — solo el primer nivel de relaciones SIDE_STORY.
 */
export async function getSideStories(anilistId: number): Promise<PrequelNode[]> {
  const media = await fetchWithRelations(anilistId);
  if (!media) return [];
  const out: PrequelNode[] = [];
  for (const e of media.relations?.edges || []) {
    if (e.relationType !== "SIDE_STORY") continue;
    const n = e.node;
    if ((n as any)?.isAdult) continue;
    if (!n || n.type !== "ANIME" || n.format === "MOVIE") continue;
    out.push({
      id: n.id,
      title: n.title?.english || n.title?.romaji || `Anime #${n.id}`,
      cover: n.coverImage?.large || "",
      episodes: n.episodes ?? null,
      status: n.status ?? null,
      format: n.format ?? null,
    });
  }
  return out;
}

/**
 * Devuelve el conjunto de anilist_ids que YA tienen enlace madre Seeke
 * (episode=0 y sources.seeke con al menos una URL). Lee todo en un solo query.
 */
const SEEKE_IDB_KEY = "seeke_master_ids";
const SEEKE_TTL = 10 * 60 * 1000; // 10 min
let seekeMem: Set<number> | null = null;
let seekePromise: Promise<Set<number>> | null = null;

/** Invalida la caché tras guardar/editar enlaces madre en admin. */
export function clearSeekeMasterCache() {
  seekeMem = null;
  seekePromise = null;
  idbDelete(SEEKE_IDB_KEY).catch(() => {});
}

export async function getAnimeIdsWithSeekeMaster(): Promise<Set<number>> {
  if (seekeMem) return seekeMem;
  if (seekePromise) return seekePromise;
  seekePromise = (async () => {
    const cached = await idbGet<number[]>(SEEKE_IDB_KEY);
    if (cached) {
      seekeMem = new Set(cached);
      return seekeMem;
    }
    const { data, error } = await supabase.rpc("get_anime_ids_with_seeke_master");
    if (error) return new Set<number>();
    const ids: number[] = [];
    ((data as any[]) || []).forEach((row) => {
      if (typeof row?.anilist_id === "number") ids.push(row.anilist_id);
    });
    seekeMem = new Set(ids);
    idbSet(SEEKE_IDB_KEY, ids, SEEKE_TTL).catch(() => {});
    return seekeMem;
  })();
  const res = await seekePromise;
  seekePromise = null;
  return res;
}

