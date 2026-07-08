import { useEffect, useState } from "react";
import { translateText } from "@/lib/translate";

/**
 * Hook: traduce a español (con cache local) la sinopsis de un anime.
 * Devuelve el texto plano; mientras carga la traducción, devuelve el original limpio.
 */
export function useTranslatedDesc(
  raw: string | null | undefined,
  cacheKey: string | number,
  maxLen?: number
): string {
  const clean = (raw || "").replace(/<[^>]+>/g, "").trim();
  const initial = maxLen ? clean.slice(0, maxLen) : clean;
  const [text, setText] = useState(initial);

  useEffect(() => {
    if (!clean) {
      setText("");
      return;
    }
    let alive = true;
    translateText(clean, `anime_desc_${cacheKey}`)
      .then((t) => {
        if (!alive || !t) return;
        setText(maxLen ? t.slice(0, maxLen) : t);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [clean, cacheKey, maxLen]);

  return text;
}
