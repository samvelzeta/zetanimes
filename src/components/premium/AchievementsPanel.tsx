import { useAchievements } from "@/hooks/useAchievements";
import { Lock, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RARITY_COLOR: Record<string, string> = {
  common: "#94a3b8",
  rare: "#3b82f6",
  epic: "#a855f7",
  legendary: "#f59e0b",
};

export default function AchievementsPanel() {
  const { achievements, unlocked, loading } = useAchievements();
  const total = achievements.length;
  const done = achievements.filter((a) => unlocked.has(a.slug)).length;

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Logros</span>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">{done}/{total}</span>
      </div>
      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {achievements.map((a) => {
          const got = unlocked.has(a.slug);
          const color = RARITY_COLOR[a.rarity] || "#94a3b8";
          return (
            <div
              key={a.slug}
              title={`${a.name} — ${a.description} · +${a.xp_reward} XP`}
              className={cn(
                "relative rounded-xl border p-3 transition",
                got ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30 opacity-60"
              )}
              style={got ? { boxShadow: `0 0 12px ${color}30` } : {}}
            >
              <div className="flex items-start justify-between">
                <span className="text-lg" aria-hidden>{iconFor(a.icon)}</span>
                {!got && <Lock className="w-3 h-3 text-muted-foreground" />}
              </div>
              <p className="mt-1 text-xs font-semibold truncate" style={{ color: got ? color : undefined }}>{a.name}</p>
              <p className="text-[10px] text-muted-foreground line-clamp-2">{a.description}</p>
              <p className="mt-1 text-[10px] text-primary/70 font-semibold">+{a.xp_reward} XP</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function iconFor(name: string): string {
  const map: Record<string, string> = {
    baby: "👶", moon: "🌙", list: "📋", crown: "👑", target: "🎯",
    sparkles: "✨", monitor: "🖥️", zap: "⚡", library: "📚", rocket: "🚀",
    globe: "🌍", flame: "🔥", cloud: "☁️", heart: "❤️", crosshair: "🎯",
    sword: "⚔️", medal: "🏅", star: "⭐", trophy: "🏆",
  };
  return map[name] || "🏆";
}
