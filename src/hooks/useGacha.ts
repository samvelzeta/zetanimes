import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Rarity } from "@/lib/cosmetics";

interface Tokens { tokens: number; total_earned: number; total_spent: number; }
interface InventoryItem { pool: string; slug: string; rarity: Rarity | null; }
export interface PullResult {
  ok: boolean;
  reason?: string;
  pool?: string;
  slug?: string;
  name?: string;
  image_url?: string | null;
  rarity?: Rarity;
}

export function useGacha() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<Tokens>({ tokens: 0, total_earned: 0, total_spent: 0 });
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setTokens({ tokens: 0, total_earned: 0, total_spent: 0 }); setInventory([]); setLoading(false); return; }
    const [t, inv] = await Promise.all([
      supabase.from("user_gacha_tokens" as any).select("tokens,total_earned,total_spent").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_gacha_inventory" as any).select("pool,slug,rarity").eq("user_id", user.id),
    ]);
    setTokens((t.data as any) || { tokens: 0, total_earned: 0, total_spent: 0 });
    setInventory((inv.data as any as InventoryItem[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  useEffect(() => {
    if (!user) return;
    const suffix = Math.random().toString(36).slice(2);
    const ch = supabase
      .channel(`gacha-${user.id}-${suffix}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_gacha_tokens", filter: `user_id=eq.${user.id}` }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_gacha_inventory", filter: `user_id=eq.${user.id}` }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, reload]);

  const pull = useCallback(async (pool: "banner" | "frame"): Promise<PullResult> => {
    const { data, error } = await supabase.rpc("gacha_pull" as any, { _pool: pool });
    if (error) throw error;
    await reload();
    return (data as any) as PullResult;
  }, [reload]);

  return { tokens, inventory, loading, pull, reload };
}

/** Set de slugs pertenecientes a un pool (para chequear unlocks rápido). */
export function inventorySlugSet(inventory: { pool: string; slug: string }[], pool: string): Set<string> {
  const s = new Set<string>();
  for (const it of inventory) if (it.pool === pool) s.add(it.slug);
  return s;
}
