import { useMissions } from "@/hooks/useMissions";
import { Loader2, Target, Check, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function MissionsPanel() {
  const { missions, progress, loading, claim, claiming } = useMissions();
  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const daily = missions.filter((m) => m.type === "daily");
  const weekly = missions.filter((m) => m.type === "weekly");

  const handleClaim = async (slug: string, title: string) => {
    const r = await claim(slug);
    if (r?.ok) {
      toast({ title: `¡+${(r as any).xp} XP!`, description: `Recompensa reclamada: ${title}` });
    } else if ((r as any)?.reason === "not_completed") {
      toast({ title: "Aún no completada", description: "Termina la misión primero.", variant: "destructive" });
    } else if ((r as any)?.reason === "already_claimed") {
      toast({ title: "Ya reclamada", description: "Esta recompensa ya fue entregada." });
    }
  };

  return (
    <div className="space-y-6">
      <MissionGroup title="Misiones diarias" missions={daily} progress={progress} onClaim={handleClaim} claiming={claiming} />
      <MissionGroup title="Misiones semanales" missions={weekly} progress={progress} onClaim={handleClaim} claiming={claiming} />
    </div>
  );
}

function MissionGroup({ title, missions, progress, onClaim, claiming }: any) {
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
          const completed = !!p?.completed_at;
          const claimed = !!p?.claimed_at;
          return (
            <div key={m.slug} className={cn(
              "rounded-xl border p-3 transition",
              claimed ? "border-primary/30 bg-primary/5 opacity-70"
                : completed ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.15)]"
                : "border-border bg-secondary/30"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{m.title}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{m.description}</p>
                </div>
                <span className="text-[10px] font-bold text-primary tabular-nums shrink-0">+{m.xp_reward} XP</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={cn("h-full transition-all", completed ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">{cur}/{m.target}</span>
              </div>
              {completed && (
                <button
                  disabled={claimed || claiming === m.slug}
                  onClick={() => onClaim(m.slug, m.title)}
                  className={cn(
                    "mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-bold rounded-lg py-1.5 transition",
                    claimed
                      ? "bg-primary/10 text-primary/60 cursor-default"
                      : "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:brightness-110 active:scale-[0.98]"
                  )}
                >
                  {claiming === m.slug ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : claimed ? (
                    <><Check className="w-3 h-3" /> Reclamada</>
                  ) : (
                    <><Gift className="w-3 h-3" /> Reclamar recompensa</>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
