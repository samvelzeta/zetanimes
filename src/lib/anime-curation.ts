import { supabase } from "@/integrations/supabase/client";
import { getVisibility, invalidateVisibility } from "@/lib/visibility-manifest";

export interface CuratableAnime {
  id: number;
  title?: { romaji?: string | null; english?: string | null } | null;
  countryOfOrigin?: string | null;
  tags?: { name?: string | null }[] | null;
}

export function getAutoHideReason(anime: CuratableAnime): string | null {
  if (anime.countryOfOrigin === "CN") return "Origen China";
  const chibi = anime.tags?.some((tag) => (tag.name || "").trim().toLowerCase() === "chibi");
  if (chibi) return "Etiqueta Chibi";
  return null;
}

export function shouldAutoHideAnime(anime: CuratableAnime): boolean {
  return !!getAutoHideReason(anime);
}

const persisted = new Set<number>();

export async function applyAnimeCuration<T extends CuratableAnime>(media: T[], options?: { skipCuration?: boolean }): Promise<T[]> {
  if (options?.skipCuration || !media.length) return media;
  const ids = media.map((anime) => anime.id).filter(Boolean);
  if (!ids.length) return media;

  // Sin consultas a la base: usamos el manifiesto de visibilidad cacheado (KV/IndexedDB).
  const { hidden } = await getVisibility();

  const autoHiddenToPersist = media.filter(
    (anime) => shouldAutoHideAnime(anime) && !hidden.has(anime.id) && !persisted.has(anime.id)
  );
  if (autoHiddenToPersist.length > 0) {
    autoHiddenToPersist.forEach((anime) => persisted.add(anime.id));
    supabase.functions
      .invoke("curate-anime", { body: { ids: autoHiddenToPersist.map((anime) => anime.id) } })
      .then(() => invalidateVisibility(false))
      .catch(() => null);
  }

  return media.filter((anime) => !hidden.has(anime.id) && !shouldAutoHideAnime(anime));
}

export async function applyAnimeCurationPage<T extends CuratableAnime, P extends { media?: T[] }>(page: P, options?: { skipCuration?: boolean }): Promise<P> {
  if (!page?.media?.length || options?.skipCuration) return page;
  return { ...page, media: await applyAnimeCuration(page.media, options) };
}