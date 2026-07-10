import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  xp: number;
  lvl: number;
  rank_slug: string;
  avatar_frame: string | null;
  banner_preset: string | null;
  banner_url: string | null;
  name_effect: string | null;
  rank_position: number;
}

export function useLeaderboard(limit = 100) {
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    supabase.rpc("get_leaderboard" as any, { _limit: limit }).then(({ data, error }) => {
      if (cancel) return;
      if (error) console.error("leaderboard", error);
      const list = ((data as any[]) || []).map((r: any) => ({
        ...r,
        xp: Number(r.xp) || 0,
        lvl: Number(r.lvl) || 1,
        rank_position: Number(r.rank_position) || 0,
      }));
      setRows(list);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [limit]);

  return { rows, loading };
}

export async function fetchUserRankPosition(userId: string): Promise<number> {
  const { data } = await supabase.rpc("get_user_rank_position" as any, { _user_id: userId });
  return Number(data) || 0;
}
