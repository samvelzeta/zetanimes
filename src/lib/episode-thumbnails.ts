import { useEffect, useState } from "react";
import { idbGet, idbSet } from "@/lib/idb-cache";

/**
 * Fuente de thumbnails por episodio.
 *
 * AniList sólo devuelve `streamingEpisodes[i].thumbnail` para una minoría de
 * animes (y a veces sólo cubre los primeros ~12 capítulos). Cuando falta,
 * pedimos las "pictures" del anime a Jikan (MyAnimeList): son varias
 * capturas/escenas oficiales que ciclamos episodio a episodio para que cada
 * capítulo tenga una imagen distinta en vez de un número o el poster repetido.
 * Como último recurso ciclamos entre banner + cover para no dejar huecos.
 */

const TTL = 7 * 24 * 60 * 60 * 1000; // 7 días

async function fetchJikanPictures(malId: number): Promise<string[]> {
  const key = `jikan-pics:${malId}`;
  const cached = await idbGet<string[]>(key);
  if (cached) return cached;
  try {
    const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/pictures`);
    if (!res.ok) return [];
    const json = await res.json();
    const pics: string[] = (json?.data || [])
      .map((p: any) => p?.jpg?.large_image_url || p?.jpg?.image_url || p?.webp?.large_image_url)
      .filter((u: any): u is string => typeof u === "string" && !!u);
    if (pics.length > 0) idbSet(key, pics, TTL);
    return pics;
  } catch {
    return [];
  }
}

export interface ThumbnailSource {
  streamingEpisodes?: { thumbnail?: string | null }[];
  idMal?: number | null;
  bannerImage?: string | null;
  coverImage?: { extraLarge?: string; large?: string } | null;
}

export async function getEpisodeThumbnails(anime: ThumbnailSource, total: number): Promise<string[]> {
  if (!total || total <= 0) return [];
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large || "";
  const banner = anime.bannerImage || "";

  const out: (string | null)[] = new Array(total).fill(null);

  // 1) AniList streamingEpisodes por índice — única fuente episodio-específica confiable
  const streaming = anime.streamingEpisodes || [];
  for (let i = 0; i < total; i++) {
    const t = streaming[i]?.thumbnail;
    if (t) out[i] = t;
  }

  // 2) Fallback a portada global de ESTA temporada. Evitamos deliberadamente
  //    Jikan /pictures porque suele incluir key visuals de arcos posteriores
  //    u otras temporadas y da la sensación de "spoilers/escenas adelantadas".
  //    Preferimos usar el banner de la serie cuando existe (más cinematográfico)
  //    y caer a la cover si no hay banner.
  const fallback = banner || cover || "";
  for (let i = 0; i < total; i++) {
    if (!out[i]) out[i] = fallback;
  }

  return out.map((v) => v || "");
}

/** Hook React con caché en memoria por anime. */
const memCache = new Map<string, string[]>();

export function useEpisodeThumbnails(anime: ThumbnailSource | null | undefined, total: number): string[] {
  const key = anime ? `${anime.idMal || "x"}:${total}` : "";
  const [thumbs, setThumbs] = useState<string[]>(() => (key && memCache.get(key)) || []);

  useEffect(() => {
    if (!anime || !total) return;
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
  }, [key]);

  return thumbs;
}
