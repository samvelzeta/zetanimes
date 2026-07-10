import { Link } from "react-router-dom";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useAuth } from "@/contexts/AuthContext";
import { rankColor, rankName } from "@/hooks/useUserXP";
import AvatarFrame from "@/components/premium/AvatarFrame";
import ProfileBanner from "@/components/premium/ProfileBanner";
import UserName from "@/components/premium/UserName";
import { Loader2, Trophy, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RankingPage() {
  const { rows, loading } = useLeaderboard(100);
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-24 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-4">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Link>
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <Trophy className="w-6 h-6 text-primary" />
            <h1 className="text-3xl md:text-4xl font-thin tracking-tight">Ranking Global</h1>
          </div>
          <p className="text-sm text-muted-foreground">Top 100 usuarios por XP · Marcos y banners visibles</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const isMe = user?.id === r.user_id;
              const color = rankColor(r.rank_slug);
              const podium = r.rank_position <= 3;
              return (
                <div
                  key={r.user_id}
                  className={cn(
                    "relative rounded-2xl border overflow-hidden transition",
                    isMe ? "border-primary shadow-[0_0_24px_hsl(var(--primary)/0.3)]" : "border-border/60 hover:border-primary/40",
                  )}
                >
                  <div className="absolute inset-0 opacity-40">
                    <ProfileBanner preset={r.banner_preset} url={r.banner_url} height={110} className="!rounded-none" />
                  </div>
                  <div className="relative flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-gradient-to-r from-background/85 via-background/60 to-background/85">
                    <div className={cn("flex-shrink-0 w-10 md:w-12 text-center font-black tabular-nums",
                      podium ? "text-2xl md:text-3xl" : "text-lg md:text-xl")}
                      style={{ color: podium ? ["#f59e0b", "#cbd5e1", "#b45309"][r.rank_position - 1] : "hsl(var(--muted-foreground))" }}>
                      #{r.rank_position}
                    </div>
                    <div className="w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
                      <AvatarFrame frame={r.avatar_frame} size={null} className="!w-full !h-full">
                        <div className="w-full h-full rounded-full overflow-hidden">
                          {r.avatar_url ? (
                            <img src={r.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary/20 flex items-center justify-center text-lg font-bold">
                              {r.display_name[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </AvatarFrame>
                    </div>
                    <div className="flex-1 min-w-0">
                      <UserName as="p" name={r.display_name} effect={r.name_effect} className="text-sm md:text-base font-semibold truncate block" />
                      <p className="text-[10px] md:text-xs" style={{ color }}>
                        {rankName(r.rank_slug)} · Nivel {r.lvl}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base md:text-lg font-thin tabular-nums" style={{ color }}>{r.xp.toLocaleString()}</p>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">XP</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 && (
              <p className="text-center py-16 text-muted-foreground text-sm">Aún no hay ranking disponible.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
