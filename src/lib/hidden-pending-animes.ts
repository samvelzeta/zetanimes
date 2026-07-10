// Ocultar temporalmente (7 días) animes de la bandeja "Pendientes de aprobación".
// Solo admin/owner (RLS lo enforce). Los registros expirados se filtran en cliente.
import { supabase } from "@/integrations/supabase/client";

export interface HiddenPending {
  anilist_id: number;
  reason: string | null;
  hidden_at: string;
  expires_at: string;
}

export async function listHiddenPending(): Promise<HiddenPending[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await (supabase as any)
    .from("hidden_pending_animes")
    .select("anilist_id, reason, hidden_at, expires_at")
    .gt("expires_at", nowIso);
  if (error) {
    console.error("[hidden-pending] list error", error);
    return [];
  }
  return (data as HiddenPending[]) || [];
}

export async function hidePendingAnime(anilistId: number, reason?: string) {
  const { error } = await (supabase as any)
    .from("hidden_pending_animes")
    .upsert({
      anilist_id: anilistId,
      reason: reason || null,
      hidden_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "anilist_id" });
  if (error) throw error;
}

export async function unhidePendingAnime(anilistId: number) {
  const { error } = await (supabase as any)
    .from("hidden_pending_animes")
    .delete()
    .eq("anilist_id", anilistId);
  if (error) throw error;
}
