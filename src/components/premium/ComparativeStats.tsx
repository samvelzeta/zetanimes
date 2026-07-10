import { useComparativeStats } from "@/hooks/useComparativeStats";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Users, Clock } from "lucide-react";

export default function ComparativeStats() {
  const { user } = useAuth();
  const { stats, loading } = useComparativeStats(user?.id);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-secondary/30 p-4 animate-pulse h-32" />
    );
  }
  if (!stats) return null;

  const ratioLabel =
    stats.ratio >= 1
      ? `${stats.ratio.toFixed(1)}× más que el promedio`
      : `${(stats.ratio * 100).toFixed(0)}% del promedio`;

  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-background/60 to-background p-5 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-wide">Cómo te comparas</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Row icon={<Clock className="w-4 h-4" />} value={stats.totalHours.toFixed(1) + " h"} label="Tu tiempo total" />
        <Row icon={<Users className="w-4 h-4" />} value={ratioLabel} label={`Prom: ${stats.avgHours.toFixed(1)} h`} />
        <Row icon={<TrendingUp className="w-4 h-4" />} value={`Top ${stats.percentileTop}%`} label="por horas vistas" />
      </div>
    </div>
  );
}

function Row({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-background/50 border border-border/50 p-3">
      <div className="flex items-center gap-1.5 text-primary/70 mb-1">{icon}<span className="text-[10px] uppercase tracking-widest">Stat</span></div>
      <p className="text-base font-bold text-foreground leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
