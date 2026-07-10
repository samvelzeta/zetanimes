// Gestión manual de slugs por anilist_id (corrige errores como HxH 2011 → Greed Island)
// Ahora vive en la tabla unificada `slugs` (columna manual_slug).
import { supabase } from "@/integrations/supabase/client";

const overrideMem = new Map<number, string | null>();

export async function getSlugOverride(anilistId: number): Promise<string | null> {
  if (overrideMem.has(anilistId)) return overrideMem.get(anilistId)!;
  const { data } = await supabase
    .from("slugs")
    .select("manual_slug")
    .eq("anilist_id", anilistId)
    .maybeSingle();
  const slug = data?.manual_slug || null;
  overrideMem.set(anilistId, slug);
  return slug;
}

export async function saveSlugOverride(params: {
  anilist_id: number;
  manual_slug: string;
  anime_title?: string;
  cover_image?: string;
  notes?: string;
  created_by?: string;
}) {
  const { error } = await supabase
    .from("slugs")
    .upsert(
      {
        anilist_id: params.anilist_id,
        manual_slug: params.manual_slug,
        title: params.anime_title ?? null,
        cover_image: params.cover_image ?? null,
        notes: params.notes ?? null,
        created_by: params.created_by ?? null,
      },
      { onConflict: "anilist_id" }
    );
  overrideMem.delete(params.anilist_id);
  return !error;
}

export async function deleteSlugOverride(anilistId: number) {
  // Solo limpiamos el manual_slug, mantenemos el cache automático (slug)
  const { error } = await supabase
    .from("slugs")
    .update({ manual_slug: null, notes: null })
    .eq("anilist_id", anilistId);
  overrideMem.delete(anilistId);
  return !error;
}

export async function listSlugOverrides() {
  const { data } = await supabase
    .from("slugs")
    .select("anilist_id, manual_slug, title, cover_image, notes, created_by, created_at, updated_at")
    .not("manual_slug", "is", null)
    .order("updated_at", { ascending: false });
  // Compat: exponer campo anime_title como antes
  return (data || []).map((r: any) => ({
    ...r,
    anime_title: r.title,
  }));
}

/**
 * Similitud Dice (bigramas) - 0..1. Útil para validar que el slug devuelto coincide con el título.
 */
export function similarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const A = norm(a);
  const B = norm(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return 0;

  const bigrams = (s: string) => {
    const out: string[] = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const ba = bigrams(A);
  const bb = bigrams(B);
  const setB = new Map<string, number>();
  bb.forEach((g) => setB.set(g, (setB.get(g) || 0) + 1));
  let hits = 0;
  ba.forEach((g) => {
    const c = setB.get(g);
    if (c && c > 0) {
      hits++;
      setB.set(g, c - 1);
    }
  });
  return (2 * hits) / (ba.length + bb.length);
}
