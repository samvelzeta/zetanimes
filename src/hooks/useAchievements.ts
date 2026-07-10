import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Achievement {
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
}

export function useAchievements() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [a, u] = await Promise.all([
        supabase.from("achievements" as any).select("*").order("condition_value", { ascending: true }),
        user
          ? supabase.from("user_achievements" as any).select("achievement_slug").eq("user_id", user.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancel) return;
      setAchievements(((a.data as any[]) || []) as Achievement[]);
      setUnlocked(new Set(((u.data as any[]) || []).map((r: any) => r.achievement_slug)));
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user]);

  return { achievements, unlocked, loading };
}
