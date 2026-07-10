import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserXP {
  xp: number;
  level: number;
  rank_slug: string;
}

const DEFAULTS: UserXP = { xp: 0, level: 1, rank_slug: "genin" };

const RANK_NAMES: Record<string, string> = {
  genin: "Genin",
  chunin: "Chunin",
  jounin: "Jounin",
  anbu: "ANBU",
  kage: "Kage",
  hokage: "Hokage",
};

const RANK_COLORS: Record<string, string> = {
  genin: "#94a3b8",
  chunin: "#22c55e",
  jounin: "#3b82f6",
  anbu: "#a855f7",
  kage: "#f59e0b",
  hokage: "#ef4444",
};

// XP requerido para alcanzar nivel N (invertimos la fórmula: nivel = floor(sqrt(xp/25))+1)
export function xpRequiredForLevel(level: number): number {
  const n = Math.max(1, level - 1);
  return n * n * 25;
}

export function rankName(slug: string): string {
  return RANK_NAMES[slug] ?? "Genin";
}

export function rankColor(slug: string): string {
  return RANK_COLORS[slug] ?? RANK_COLORS.genin;
}

export function levelProgress(xp: number, level: number): { current: number; needed: number; pct: number } {
  const base = xpRequiredForLevel(level);
  const next = xpRequiredForLevel(level + 1);
  const current = Math.max(0, xp - base);
  const needed = Math.max(1, next - base);
  return { current, needed, pct: Math.min(100, Math.round((current / needed) * 100)) };
}

export function useUserXP() {
  const { user } = useAuth();
  const [xp, setXp] = useState<UserXP>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [prevLevel, setPrevLevel] = useState<number | null>(null);
  const [leveledUp, setLeveledUp] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (!user) {
      setXp(DEFAULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("user_xp" as any)
      .select("xp,level,rank_slug")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        const row = (data as any) ?? DEFAULTS;
        const next: UserXP = {
          xp: Number(row.xp ?? 0),
          level: row.level ?? 1,
          rank_slug: row.rank_slug ?? "genin",
        };
        setXp(next);
        setPrevLevel(next.level);
        setLoading(false);
      });

    const ch = supabase
      .channel(`user-xp-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_xp", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          const next: UserXP = {
            xp: Number(row.xp ?? 0),
            level: row.level ?? 1,
            rank_slug: row.rank_slug ?? "genin",
          };
          setXp((prev) => {
            if (prev.level && next.level > prev.level) {
              setLeveledUp(true);
              setTimeout(() => setLeveledUp(false), 5000);
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => {
      cancel = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return { xp, loading, leveledUp };
}
