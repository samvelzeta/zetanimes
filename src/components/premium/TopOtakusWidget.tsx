import { Link } from "react-router-dom";
import { Trophy, ChevronRight } from "lucide-react";
import { useLeaderboard, fetchUserRankPosition } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { rankColor, rankName } from "@/hooks/useUserXP";
import AvatarFrame from "@/components/premium/AvatarFrame";
import ProfileBanner from "@/components/premium/ProfileBanner";
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
        <div className="space-y-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6 text-center">Aún no hay ranking.</p>
      ) : (
        <ol className="space-y-3">
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
                    "relative block rounded-2xl border overflow-hidden transition group",
                    isMe
                      ? "border-primary shadow-[0_0_18px_hsl(var(--primary)/0.35)]"
                      : "border-border/60 hover:border-primary/50",
                  )}
                >
                  {/* Banner de fondo del usuario (equipado) */}
                  <div className="absolute inset-0 opacity-60 group-hover:opacity-75 transition">
                    <ProfileBanner
                      preset={r.banner_preset}
                      url={r.banner_url}
                      height={96}
                      className="!rounded-none !h-full"
                    />
                  </div>
                  {/* Velo para legibilidad */}
                  <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/60 to-background/85" />

                  <div className="relative flex items-center gap-3 p-3">
                    <span
                      className={cn(
                        "w-7 text-center font-black tabular-nums flex-shrink-0",
                        podium ? "text-2xl" : "text-lg text-muted-foreground",
                      )}
                      style={podium ? { color: medal, textShadow: `0 0 12px ${medal}80` } : undefined}
                    >
                      #{r.rank_position}
                    </span>

                    {/* Avatar con marco equipado */}
                    <div className="w-14 h-14 flex-shrink-0">
                      <AvatarFrame frame={r.avatar_frame} size={null} className="!w-full !h-full">
                        <div className="w-full h-full rounded-full overflow-hidden">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-base font-bold">
                              {r.display_name[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </AvatarFrame>
                    </div>

                    <div className="flex-1 min-w-0">
                      <UserName
                        as="p"
                        name={r.display_name}
                        effect={r.name_effect}
                        className="text-sm font-bold truncate block"
                      />
                      <p className="text-[10px] font-semibold" style={{ color }}>
                        {rankName(r.rank_slug)} · Nivel {r.lvl}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-thin tabular-nums leading-none" style={{ color }}>
                        {r.xp.toLocaleString()}
                      </p>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">XP</p>
                    </div>
                  </div>
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
