import { supabase } from "@/integrations/supabase/client";

/**
 * Purga el caché caliente del edge `resolve-stream` para un anime concreto.
 *
 * El edge cachea los enlaces resueltos con TTL dinámico:
 *  - En emisión  → 2.5 min (episodio) / 1 min (latest)
 *  - Finalizado  → 6 h (episodio) / 1 h (latest)
 *
 * Cuando el admin edita, reemplaza o elimina un enlace madre Seeke (o cambia el
 * slug), hay que anular ese caché para que el cambio se vea al instante y no se
 * quede sirviendo el audio/idioma anterior.
 */
export async function invalidateStreamCache(anilistId: number): Promise<void> {
  if (!anilistId) return;
  try {
    await supabase.functions.invoke("resolve-stream", {
      body: { action: "invalidate", anilistId },
    });
  } catch (err) {
    console.warn("[stream-cache] invalidate failed", err);
  }
}
