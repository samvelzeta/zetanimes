import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WrappedData {
  year: number;
  totalSeconds: number;
  totalHours: number;
  totalEpisodes: number;
  completedEpisodes: number;
  uniqueAnimes: number;
  topAnimes: { id: number; title: string; cover: string | null; episodes: number }[];
  peakDay: { date: string; hours: number } | null;
  activeDays: number;
  avgPerDay: number;
}

export function useWrapped(userId: string | null | undefined, year: number) {
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setData(null); setLoading(false); return; }
    let cancel = false;
    setLoading(true);

    (async () => {
      const start = `${year}-01-01T00:00:00Z`;
      const end = `${year + 1}-01-01T00:00:00Z`;
      const { data: rows, error } = await supabase
        .from("watch_history")
        .select("anime_id,anime_title,anime_cover,episode_number,watch_duration_seconds,completed,created_at")
        .eq("user_id", userId)
        .gte("created_at", start)
        .lt("created_at", end)
        .limit(5000);

      if (cancel) return;
      if (error || !rows) {
        setData({
          year, totalSeconds: 0, totalHours: 0, totalEpisodes: 0,
          completedEpisodes: 0, uniqueAnimes: 0, topAnimes: [],
          peakDay: null, activeDays: 0, avgPerDay: 0,
        });
        setLoading(false);
        return;
      }

      const totalSeconds = rows.reduce((s, r) => s + (r.watch_duration_seconds || 0), 0);
      const completedEpisodes = rows.filter((r) => r.completed).length;
      const byAnime = new Map<number, { title: string; cover: string | null; episodes: number }>();
      const byDay = new Map<string, number>();

      for (const r of rows) {
        const cur = byAnime.get(r.anime_id) || { title: r.anime_title || `Anime ${r.anime_id}`, cover: r.anime_cover, episodes: 0 };
        cur.episodes += 1;
        cur.title = r.anime_title || cur.title;
        cur.cover = r.anime_cover || cur.cover;
        byAnime.set(r.anime_id, cur);

        const day = r.created_at.slice(0, 10);
        byDay.set(day, (byDay.get(day) || 0) + (r.watch_duration_seconds || 0));
      }

      const topAnimes = Array.from(byAnime.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.episodes - a.episodes)
        .slice(0, 5);

      let peakDay: { date: string; hours: number } | null = null;
      for (const [date, secs] of byDay) {
        const hours = secs / 3600;
        if (!peakDay || hours > peakDay.hours) peakDay = { date, hours };
      }

      const activeDays = byDay.size;
      const totalHours = totalSeconds / 3600;

      setData({
        year,
        totalSeconds,
        totalHours,
        totalEpisodes: rows.length,
        completedEpisodes,
        uniqueAnimes: byAnime.size,
        topAnimes,
        peakDay,
        activeDays,
        avgPerDay: activeDays ? totalHours / activeDays : 0,
      });
      setLoading(false);
    })();

    return () => { cancel = true; };
  }, [userId, year]);

  return { data, loading };
}
