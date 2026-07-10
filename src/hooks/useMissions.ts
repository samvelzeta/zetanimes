import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Mission {
  slug: string;
  title: string;
  description: string;
  type: "daily" | "weekly" | string;
  target: number;
  xp_reward: number;
  icon: string;
  active: boolean;
}

export interface UserMissionProgress {
  mission_slug: string;
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
  cycle_started_at: string | null;
}

export function useMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progress, setProgress] = useState<Map<string, UserMissionProgress>>(new Map());
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, p] = await Promise.all([
      supabase.from("roleplay_missions" as any).select("*").eq("active", true).order("target", { ascending: true }),
      user
        ? supabase.from("user_missions" as any).select("mission_slug,progress,completed_at,claimed_at,cycle_started_at").eq("user_id", user.id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setMissions(((m.data as any[]) || []) as Mission[]);
    const map = new Map<string, UserMissionProgress>();
    ((p.data as any[]) || []).forEach((row: any) => map.set(row.mission_slug, row));
    setProgress(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (cancel) return;
      await load();
    })();
    return () => { cancel = true; };
  }, [load]);

  const claim = useCallback(async (slug: string) => {
    if (!user) return { ok: false, reason: "not_authenticated" };
    setClaiming(slug);
    const { data, error } = await supabase.rpc("claim_mission" as any, { _slug: slug });
    setClaiming(null);
    if (error) return { ok: false, reason: error.message };
    await load();
    return data as { ok: boolean; xp?: number; reason?: string };
  }, [user, load]);

  return { missions, progress, loading, claim, claiming };
}
