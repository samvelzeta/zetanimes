import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AniListMedia } from "@/lib/anilist";

// Cache global de slugs con doblaje latino.
let dubbedSlugsPromise: Promise<Set<string>> | null = null;
let dubbedSlugsCache: Set<string> | null = null;

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

async function fetchDubbedSlugs(): Promise<Set<string>> {
  if (dubbedSlugsCache) return dubbedSlugsCache;
  if (!dubbedSlugsPromise) {
    dubbedSlugsPromise = (async () => {
      const { data } = await supabase
        .from("latino_episodes")
        .select("slug")
        .limit(5000);
      const set = new Set<string>();
      (data || []).forEach((r: any) => r?.slug && set.add(r.slug));
      dubbedSlugsCache = set;
      return set;
    })();
  }
  return dubbedSlugsPromise;
}

function candidatesFor(anime: Pick<AniListMedia, "title">): string[] {
  const t = anime.title || {};
  const raw = [t.english, t.romaji, (t as any).native].filter(Boolean) as string[];
  const out = new Set<string>();
  for (const r of raw) {
    const k = toKebab(r);
    if (k) out.add(k);
    // Sin sufijos temporada / part
    const stripped = toKebab(r.replace(/\s*(season|part|cour|s)\s*\d+/gi, ""));
    if (stripped) out.add(stripped);
    // Antes de dos puntos
    const before = toKebab(r.split(/[:\-–—]/)[0]);
    if (before) out.add(before);
  }
  return [...out];
}

export function useIsDubbed(anime: Pick<AniListMedia, "title"> | null | undefined): boolean {
  const [dubbed, setDubbed] = useState(false);
  useEffect(() => {
    if (!anime) return;
    let alive = true;
    fetchDubbedSlugs().then((set) => {
      if (!alive) return;
      const cands = candidatesFor(anime);
      setDubbed(cands.some((c) => set.has(c)));
    });
    return () => { alive = false; };
  }, [anime?.title?.english, anime?.title?.romaji]);
  return dubbed;
}
