import { supabase } from "@/integrations/supabase/client";

export interface CuratableAnime {
  id: number;
  title?: { romaji?: string | null; english?: string | null } | null;
  countryOfOrigin?: string | null;
  tags?: { name?: string | null }[] | null;
}

type HiddenRow = { anilist_id: number; is_hidden?: boolean | null };

function animeTitle(anime: CuratableAnime) {
  return anime.title?.english || anime.title?.romaji || `Anime ${anime.id}`;
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

export async function applyAnimeCuration<T extends CuratableAnime>(media: T[], options?: { skipCuration?: boolean }): Promise<T[]> {
  if (options?.skipCuration || !media.length) return media;
  const ids = media.map((anime) => anime.id).filter(Boolean);
  if (!ids.length) return media;

  const { data } = await supabase
    .from("hidden_home_animes" as any)
    .select("anilist_id,is_hidden")
    .in("anilist_id", ids);
  const rows = new Map<number, HiddenRow>((data || []).map((row: any) => [row.anilist_id, row]));

  const autoHiddenToPersist = media.filter((anime) => shouldAutoHideAnime(anime) && !rows.has(anime.id));
  if (autoHiddenToPersist.length > 0) {
    const payload = autoHiddenToPersist.map((anime) => ({
      anilist_id: anime.id,
      anime_title: animeTitle(anime),
      reason: getAutoHideReason(anime),
      country_of_origin: anime.countryOfOrigin ?? null,
      tags: (anime.tags || []).map((tag) => tag.name).filter(Boolean),
      auto_hidden: true,
      source: "anilist-filter",
      is_hidden: true,
    }));
    // Si el visitante no es admin, RLS puede bloquear esta escritura; igual filtramos en memoria.
    await supabase.from("hidden_home_animes" as any).upsert(payload as any, { onConflict: "anilist_id" });
  }

  return media.filter((anime) => {
    const existing = rows.get(anime.id);
    if (existing) return existing.is_hidden !== true;
    return !shouldAutoHideAnime(anime);
  });
}

export async function applyAnimeCurationPage<T extends CuratableAnime, P extends { media?: T[] }>(page: P, options?: { skipCuration?: boolean }): Promise<P> {
  if (!page?.media?.length || options?.skipCuration) return page;
  return { ...page, media: await applyAnimeCuration(page.media, options) };
}