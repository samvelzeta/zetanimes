import { useUserXP, levelProgress, rankName, rankColor } from "@/hooks/useUserXP";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  compact?: boolean;
}

export default function XPBar({ className, compact }: Props) {
  const { xp } = useUserXP();
  const { current, needed, pct } = levelProgress(xp.xp, xp.level);
  const color = rankColor(xp.rank_slug);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-semibold" style={{ color }}>
          {rankName(xp.rank_slug)} · Nv {xp.level}
        </span>
        {!compact && (
          <span className="text-muted-foreground tabular-nums">
            {current.toLocaleString()} / {needed.toLocaleString()} XP
          </span>
        )}
      </div>
      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            boxShadow: `0 0 12px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}
