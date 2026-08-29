import { supabase } from "@/integrations/supabase/client";
import { getVisibility, invalidateVisibility } from "@/lib/visibility-manifest";

export type AnimeStatus = "RELEASING" | "FINISHED" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";

export interface AnimeStatusOverride {
  id: string;
  anilist_id: number;
  anime_title: string | null;
  cover_image: string | null;
  manual_status: AnimeStatus;
  notes: string | null;
  updated_at: string;
}

export async function getAnimeStatusOverrides(ids: number[]): Promise<Map<number, AnimeStatus>> {
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (!clean.length) return new Map();
  const { statusOverrides } = await getVisibility();
  const out = new Map<number, AnimeStatus>();
  for (const id of clean) {
    const st = statusOverrides.get(id);
    if (st) out.set(id, st as AnimeStatus);
  }
  return out;
}

export async function applyStatusOverrides<T extends { id: number; status?: string | null }>(media: T[]): Promise<T[]> {
  if (!media.length) return media;
  const overrides = await getAnimeStatusOverrides(media.map((anime) => anime.id));
  if (!overrides.size) return media;
  return media.map((anime) => overrides.has(anime.id) ? { ...anime, status: overrides.get(anime.id)! } : anime);
}

export async function listAnimeStatusOverrides(): Promise<AnimeStatusOverride[]> {
  const { data } = await supabase
    .from("anime_status_overrides" as any)
    .select("*")
    .order("updated_at", { ascending: false });
  return (data as any[]) || [];
}

export async function upsertAnimeStatusOverride(params: {
  anilist_id: number;
  anime_title?: string | null;
  cover_image?: string | null;
  manual_status: AnimeStatus;
  notes?: string | null;
  created_by?: string | null;
}) {
  const { error } = await supabase.from("anime_status_overrides" as any).upsert({
    anilist_id: params.anilist_id,
    anime_title: params.anime_title ?? null,
    cover_image: params.cover_image ?? null,
    manual_status: params.manual_status,
    notes: params.notes ?? null,
    created_by: params.created_by ?? null,
    updated_at: new Date().toISOString(),
  } as any, { onConflict: "anilist_id" });
  await invalidateVisibility().catch(() => {});
  return { success: !error, error: error?.message };
}

export async function deleteAnimeStatusOverride(anilistId: number) {
  const { error } = await supabase.from("anime_status_overrides" as any).delete().eq("anilist_id", anilistId);
  await invalidateVisibility().catch(() => {});
  return { success: !error, error: error?.message };
}