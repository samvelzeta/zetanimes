import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet } from "@/lib/idb-cache";
import type { AniListMedia } from "@/lib/anilist";

/**
 * Detecta si un anime tiene doblaje latino leyendo la BBDD real:
 *   1) video_cache (episodios latino individuales)
 *   2) video_cache_blocks (bloques Seeke latino)
 * Se cachea globalmente en memoria; la carga sucede una sola vez por sesión.
 */

const DUB_IDB_KEY = "dubbed_anime_ids";
const DUB_TTL = 30 * 60 * 1000; // 30 min

let dubbedPromise: Promise<{ ids: Set<number>; slugs: Set<string> }> | null = null;
let dubbedCache: { ids: Set<number>; slugs: Set<string> } | null = null;

function toKebab(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Invalida el cache de doblajes (usar tras guardar/borrar un enlace latino en admin). */
export function clearDubbedCache() {
  dubbedCache = null;
  dubbedPromise = null;
  import("@/lib/idb-cache").then(({ idbDelete }) => idbDelete(DUB_IDB_KEY)).catch(() => {});
}

async function fetchDubbed(): Promise<{ ids: Set<number>; slugs: Set<string> }> {
  if (dubbedCache) return dubbedCache;
  if (!dubbedPromise) {
    dubbedPromise = (async () => {
      const cached = await idbGet<{ ids: number[]; slugs: string[] }>(DUB_IDB_KEY);
      if (cached) {
        dubbedCache = { ids: new Set(cached.ids), slugs: new Set(cached.slugs) };
        return dubbedCache;
      }
      const ids = new Set<number>();
      const slugs = new Set<string>();
      const dubs = await supabase.rpc("list_dubbed_anime_ids");
      ((dubs.data as any[]) || []).forEach((r: any) => {
        if (typeof r.anilist_id === "number") ids.add(r.anilist_id);
        if (r.slug) slugs.add(r.slug);
      });
      dubbedCache = { ids, slugs };
      idbSet(DUB_IDB_KEY, { ids: [...ids], slugs: [...slugs] }, DUB_TTL).catch(() => {});
      return dubbedCache;
    })();
  }
  return dubbedPromise;
}

function candidatesFor(anime: Pick<AniListMedia, "title">): string[] {
  const t: any = anime.title || {};
  const raw = [t.english, t.romaji, t.native].filter(Boolean) as string[];
  const out = new Set<string>();
  for (const r of raw) {
    const k = toKebab(r);
    if (k) out.add(k);
    const stripped = toKebab(r.replace(/\s*(season|part|cour|s)\s*\d+/gi, ""));
    if (stripped) out.add(stripped);
  }
  return [...out];
}

export function useIsDubbed(
  anime: (Pick<AniListMedia, "title"> & { id?: number }) | null | undefined
): boolean {
  const [dubbed, setDubbed] = useState(false);
  const id = anime?.id;
  const romaji = anime?.title?.romaji;
  const english = anime?.title?.english;
  useEffect(() => {
    if (!anime) return;
    let alive = true;
    fetchDubbed().then(({ ids, slugs }) => {
      if (!alive) return;
      if (typeof id === "number" && ids.has(id)) {
        setDubbed(true);
        return;
      }
      const cands = candidatesFor(anime);
      setDubbed(cands.some((c) => slugs.has(c)));
    });
    return () => { alive = false; };
  }, [id, romaji, english]);
  return dubbed;
}
