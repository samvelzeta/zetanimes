import { useMissions } from "@/hooks/useMissions";
import { Loader2, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MissionsPanel() {
  const { missions, progress, loading } = useMissions();
  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const daily = missions.filter((m) => m.type === "daily");
  const weekly = missions.filter((m) => m.type === "weekly");

  return (
    <div className="space-y-6">
      <MissionGroup title="Misiones diarias" missions={daily} progress={progress} />
      <MissionGroup title="Misiones semanales" missions={weekly} progress={progress} />
    </div>
  );
}

function MissionGroup({ title, missions, progress }: any) {
  if (!missions.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="space-y-2">
        {missions.map((m: any) => {
          const p = progress.get(m.slug);
          const cur = p?.progress ?? 0;
          const pct = Math.min(100, Math.round((cur / m.target) * 100));
          const done = !!p?.completed_at;
          return (
            <div key={m.slug} className={cn("rounded-xl border p-3", done ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/30")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground">{m.description}</p>
                </div>
                <span className="text-[10px] font-bold text-primary tabular-nums">+{m.xp_reward} XP</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">{cur}/{m.target}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
