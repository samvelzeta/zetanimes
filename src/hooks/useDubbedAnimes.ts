import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AniListMedia } from "@/lib/anilist";

/**
 * Detecta si un anime tiene doblaje latino leyendo la BBDD real:
 *   1) video_cache (episodios latino individuales)
 *   2) video_cache_blocks (bloques Seeke latino)
 *   3) latino_episodes (uploads directos)
 * Los tres se cruzan por anilist_id (video_cache*) o por slug (latino_episodes).
 * Se cachea globalmente en memoria; la carga sucede una sola vez por sesión.
 */

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

async function fetchDubbed(): Promise<{ ids: Set<number>; slugs: Set<string> }> {
  if (dubbedCache) return dubbedCache;
  if (!dubbedPromise) {
    dubbedPromise = (async () => {
      const ids = new Set<number>();
      const slugs = new Set<string>();
      const [dubs, le] = await Promise.all([
        supabase.rpc("list_dubbed_anime_ids"),
        supabase.from("latino_episodes").select("slug").limit(10000),
      ]);
      ((dubs.data as any[]) || []).forEach((r: any) => {
        if (typeof r.anilist_id === "number") ids.add(r.anilist_id);
        if (r.slug) slugs.add(r.slug);
      });
      (le.data || []).forEach((r: any) => r?.slug && slugs.add(r.slug));
      dubbedCache = { ids, slugs };
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
