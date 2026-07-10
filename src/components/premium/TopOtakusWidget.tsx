import { Link } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";
import { useLeaderboard, fetchUserRankPosition } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { rankColor, rankName } from "@/hooks/useUserXP";
import AvatarFrame from "@/components/premium/AvatarFrame";
import UserName from "@/components/premium/UserName";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  limit?: number;
  compact?: boolean;
  title?: string;
}

/** Widget compacto que muestra el Top de otakus y (si hay sesión) la posición del usuario. */
export default function TopOtakusWidget({ limit = 5, compact = false, title = "🏆 Top Otakus" }: Props) {
  const { rows, loading } = useLeaderboard(limit);
  const { user } = useAuth();
  const [myPos, setMyPos] = useState<number | null>(null);

  useEffect(() => {
    if (!user) { setMyPos(null); return; }
    fetchUserRankPosition(user.id).then((p) => setMyPos(p || null));
  }, [user?.id]);

  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent p-4",
      compact && "p-3",
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold tracking-tight">{title}</h3>
        </div>
        <Link to="/ranking" className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary flex items-center gap-0.5">
          Ver todo <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Aún no hay ranking.</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.slice(0, limit).map((r) => {
            const isMe = user?.id === r.user_id;
            const color = rankColor(r.rank_slug);
            const podium = r.rank_position <= 3;
            const medal = ["#f59e0b", "#cbd5e1", "#b45309"][r.rank_position - 1];
            return (
              <li key={r.user_id}>
                <Link
                  to="/ranking"
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition",
                    isMe ? "bg-primary/10 border border-primary/40" : "hover:bg-white/[0.04]",
                  )}
                >
                  <span
                    className={cn("w-5 text-center text-xs font-black tabular-nums", podium ? "text-sm" : "")}
                    style={{ color: podium ? medal : "hsl(var(--muted-foreground))" }}
                  >
                    {r.rank_position}
                  </span>
                  <div className="w-7 h-7 flex-shrink-0">
                    <AvatarFrame frame={r.avatar_frame} size={null} className="!w-full !h-full">
                      <div className="w-full h-full rounded-full overflow-hidden">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-primary/20 flex items-center justify-center text-[10px] font-bold">
                            {r.display_name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    </AvatarFrame>
                  </div>
                  <div className="flex-1 min-w-0">
                    <UserName as="p" name={r.display_name} effect={r.name_effect} className="text-xs font-semibold truncate block" />
                    <p className="text-[9px]" style={{ color }}>{rankName(r.rank_slug)} · Nv {r.lvl}</p>
                  </div>
                  <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                    {r.xp >= 1000 ? `${(r.xp / 1000).toFixed(1)}k` : r.xp}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}

      {user && myPos && myPos > limit && (
        <Link
          to="/ranking"
          className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs hover:bg-primary/20 transition"
        >
          <span className="font-semibold text-primary">Tu posición: #{myPos}</span>
          <ChevronRight className="w-3.5 h-3.5 text-primary" />
        </Link>
      )}
    </div>
  );
}
