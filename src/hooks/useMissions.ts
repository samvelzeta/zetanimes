import { useEffect, useState } from "react";
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
  cycle_started_at: string | null;
}

export function useMissions() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [progress, setProgress] = useState<Map<string, UserMissionProgress>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [m, p] = await Promise.all([
        supabase.from("roleplay_missions" as any).select("*").eq("active", true).order("target", { ascending: true }),
        user
          ? supabase.from("user_missions" as any).select("mission_slug,progress,completed_at,cycle_started_at").eq("user_id", user.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancel) return;
      setMissions(((m.data as any[]) || []) as Mission[]);
      const map = new Map<string, UserMissionProgress>();
      ((p.data as any[]) || []).forEach((row: any) => map.set(row.mission_slug, row));
      setProgress(map);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  return { missions, progress, loading };
}
