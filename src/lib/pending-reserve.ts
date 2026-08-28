import { supabase } from "@/integrations/supabase/client";
import { idbGet, idbSet, idbDelete } from "@/lib/idb-cache";
import { getAdultAnimeIds } from "@/lib/adult-animes";

export interface ReserveAnimeInput {
  id?: number;
  title?: {
    romaji?: string | null;
    english?: string | null;
  } | null;
  coverImage?: {
    large?: string | null;
    extraLarge?: string | null;
  } | null;
  status?: string | null;
  format?: string | null;
  episodes?: number | null;
  averageScore?: number | null;
}

export interface PendingReserveRow {
  id: string;
  anilist_id: number;
  title: string;
  romaji_title: string | null;
  english_title: string | null;
  cover_image: string | null;
  status: string | null;
  format: string | null;
  episodes: number | null;
  average_score: number | null;
  source: string;
  priority: number;
  reserve_state: "available" | "consumed" | string;
  last_seen_at: string;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingReserveStats {
  total: number;
  available: number;
  consumed: number;
  approved: number;
  hidden_active: number;
  seeke_master: number;
}

function titleOf(media: ReserveAnimeInput) {
  return media.title?.romaji || media.title?.english || `Anime #${media.id}`;
}

function reserveRowFromAnime(media: ReserveAnimeInput, source: string, priority = 0) {
  return {
    anilist_id: media.id,
    title: titleOf(media),
    romaji_title: media.title?.romaji || null,
    english_title: media.title?.english || null,
    cover_image: media.coverImage?.large || media.coverImage?.extraLarge || null,
    status: media.status || null,
    format: media.format || null,
    episodes: media.episodes ?? null,
    average_score: media.averageScore ?? null,
    source,
    priority,
    reserve_state: "available",
    last_seen_at: new Date().toISOString(),
  };
}

export async function listPendingReserve(limit = 500): Promise<PendingReserveRow[]> {
  const { data, error } = await (supabase as any)
    .from("pending_anime_reserve")
    .select("*")
    .order("priority", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[pending-reserve] list error", error);
    return [];
  }
  return (data || []) as PendingReserveRow[];
}

export async function getPendingReserveStats(): Promise<PendingReserveStats> {
  const { data, error } = await (supabase as any).rpc("get_pending_reserve_admin_stats");
  if (error) {
    console.error("[pending-reserve] stats error", error);
    return { total: 0, available: 0, consumed: 0, approved: 0, hidden_active: 0, seeke_master: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total: Number(row?.total || 0),
    available: Number(row?.available || 0),
    consumed: Number(row?.consumed || 0),
    approved: Number(row?.approved || 0),
    hidden_active: Number(row?.hidden_active || 0),
    seeke_master: Number(row?.seeke_master || 0),
  };
}

const RESERVE_IDB_KEY = "unreleased_reserve_ids";
const RESERVE_TTL = 10 * 60 * 1000;
let reserveMem: Set<number> | null = null;
let reservePromise: Promise<Set<number>> | null = null;

export function clearUnreleasedReserveCache() {
  reserveMem = null;
  reservePromise = null;
  idbDelete(RESERVE_IDB_KEY).catch(() => {});
}

export async function getUnreleasedReserveAnimeIds(): Promise<Set<number>> {
  if (reserveMem) return reserveMem;
  if (reservePromise) return reservePromise;
  reservePromise = (async () => {
    const cached = await idbGet<number[]>(RESERVE_IDB_KEY);
    if (cached) {
      reserveMem = new Set(cached);
      return reserveMem;
    }
    const { data, error } = await (supabase as any).rpc("get_unreleased_reserve_anime_ids");
    if (error) return new Set<number>();
    const ids = ((data as any[]) || []).map((r) => Number(r.anilist_id)).filter(Number.isFinite);
    reserveMem = new Set<number>(ids);
    idbSet(RESERVE_IDB_KEY, ids, RESERVE_TTL).catch(() => {});
    return reserveMem;
  })();
  const res = await reservePromise;
  reservePromise = null;
  return res;
}

export async function upsertPendingReserveFromAnime(
  items: ReserveAnimeInput[],
  source: string,
  priority = 0
): Promise<{ success: boolean; count: number; error?: string }> {
  const adult = await getAdultAnimeIds();
  const unique = new Map<number, ReserveAnimeInput>();
  for (const item of items) {
    if (!item?.id || !Number.isFinite(Number(item.id))) continue;
    // Nunca guardamos animes con etiqueta adulta en la reserva de pendientes.
    if (adult.has(Number(item.id))) continue;
    unique.set(Number(item.id), item);
  }
  const rows = Array.from(unique.values()).map((item, idx) => reserveRowFromAnime(item, source, priority - idx));
  if (!rows.length) return { success: true, count: 0 };

  const { error } = await (supabase as any)
    .from("pending_anime_reserve")
    .upsert(rows, { onConflict: "anilist_id" });

  if (error) return { success: false, count: 0, error: error.message };
  return { success: true, count: rows.length };
}

export async function markReserveConsumed(anilistId: number): Promise<void> {
  await (supabase as any)
    .from("pending_anime_reserve")
    .update({ reserve_state: "consumed", consumed_at: new Date().toISOString() })
    .eq("anilist_id", anilistId);
}