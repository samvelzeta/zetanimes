import { useEffect, useMemo, useState } from "react";

/**
 * Fuente de thumbnails por episodio.
 *
 * Algunas miniaturas por episodio de APIs externas pueden venir mezcladas con
 * imágenes promocionales, arcos futuros o temporadas equivocadas. Para evitar
 * spoilers/confusión visual, usamos una sola imagen global de ESTA ficha.
 */

export interface ThumbnailSource {
  id?: number | null;
  streamingEpisodes?: { thumbnail?: string | null }[];
  idMal?: number | null;
  bannerImage?: string | null;
  coverImage?: { extraLarge?: string; large?: string } | null;
}

function getGlobalEpisodeImage(anime: ThumbnailSource | null | undefined): string {
  if (!anime) return "";
  return anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large || "";
}

export async function getEpisodeThumbnails(anime: ThumbnailSource, total: number): Promise<string[]> {
  if (!total || total <= 0) return [];
  const fallback = getGlobalEpisodeImage(anime);
  return Array.from({ length: total }, () => fallback);
}

/** Hook React con caché en memoria por anime. */
const memCache = new Map<string, string[]>();

export function useEpisodeThumbnails(anime: ThumbnailSource | null | undefined, total: number): string[] {
  const fallback = getGlobalEpisodeImage(anime);
  const key = anime ? `${anime.id || anime.idMal || fallback || "x"}:${total}:${fallback}` : "";
  const fallbackThumbs = useMemo(() => Array.from({ length: Math.max(total, 0) }, () => fallback), [fallback, total]);
  const [thumbs, setThumbs] = useState<string[]>(() => (key && memCache.get(key)) || fallbackThumbs);

  useEffect(() => {
    if (!anime || !total) {
      setThumbs([]);
      return;
    }
    const cached = memCache.get(key);
    if (cached && cached.length === total) {
      setThumbs(cached);
      return;
    }
    let cancelled = false;
    getEpisodeThumbnails(anime, total).then((arr) => {
      if (cancelled) return;
      memCache.set(key, arr);
      setThumbs(arr);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, total]);

  return thumbs;
}
