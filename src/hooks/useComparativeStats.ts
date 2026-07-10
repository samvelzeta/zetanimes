import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ComparativeStats {
  totalHours: number;
  avgHours: number;
  ratio: number;              // usuario / promedio
  percentileTop: number;      // "top X%"
  activeDays: number;
  avgActiveDays: number;
}

export function useComparativeStats(userId: string | null | undefined) {
  const [stats, setStats] = useState<ComparativeStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setStats(null); setLoading(false); return; }
    let cancel = false;
    setLoading(true);

    // Cache 1h en localStorage
    const cacheKey = `zet:compare:${userId}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.expiresAt > Date.now()) {
          setStats(cached.stats);
          setLoading(false);
          return;
        }
      }
    } catch { /* noop */ }

    (async () => {
      const { data: all, error } = await supabase
        .from("profile_stats")
        .select("user_id,total_watch_seconds");
      if (cancel) return;
      if (error || !all || all.length === 0) {
        setStats(null); setLoading(false); return;
      }

      const me = all.find((r) => r.user_id === userId);
      const mySecs = me?.total_watch_seconds || 0;
      const sorted = all.map((r) => r.total_watch_seconds || 0).sort((a, b) => b - a);
      const total = sorted.reduce((s, v) => s + v, 0);
      const avgSecs = total / sorted.length;
      const rankIdx = sorted.findIndex((v) => v <= mySecs);
      const percentileTop = Math.max(1, Math.round(((rankIdx < 0 ? sorted.length : rankIdx + 1) / sorted.length) * 100));

      const result: ComparativeStats = {
        totalHours: mySecs / 3600,
        avgHours: avgSecs / 3600,
        ratio: avgSecs > 0 ? mySecs / avgSecs : 0,
        percentileTop,
        activeDays: 0,
        avgActiveDays: 0,
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          stats: result,
          expiresAt: Date.now() + 60 * 60 * 1000,
        }));
      } catch { /* noop */ }

      setStats(result);
      setLoading(false);
    })();

    return () => { cancel = true; };
  }, [userId]);

  return { stats, loading };
}
