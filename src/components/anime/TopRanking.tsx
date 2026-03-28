import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  title: string;
  animes: AniListMedia[];
  loading?: boolean;
}

export default function TopRanking({ title, animes, loading }: Props) {
  if (loading) {
    return (
      <section className="px-4 mb-8">
        <div className="h-5 w-40 bg-secondary rounded-md mb-4 animate-pulse" />
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="h-16 bg-secondary rounded-xl mb-2 animate-pulse" />
        ))}
      </section>
    );
  }

  const items = animes.slice(0, 10);
  if (!items.length) return null;

  return (
    <section className="px-4 mb-8">
      <h2 className="text-base font-bold text-foreground tracking-tight mb-4">{title}</h2>
      <div className="space-y-2">
        {items.map((anime, i) => {
          const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
          const isTop3 = i < 3;
          return (
            <Link key={anime.id} to={`/anime/${anime.id}`} className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-secondary/80 ${isTop3 ? "bg-secondary border border-primary/20" : "bg-secondary/50"}`}>
              <span className={`text-2xl font-black w-8 text-center flex-shrink-0 ${isTop3 ? "text-primary" : "text-muted-foreground/50"}`}>#{i + 1}</span>
              <img src={anime.coverImage?.large || anime.coverImage?.extraLarge} alt={getTitle(anime)} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" loading="lazy" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{getTitle(anime)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isTop3 ? "bg-primary" : "bg-muted-foreground/40"}`} style={{ width: `${anime.averageScore || 0}%` }} />
                  </div>
                </div>
              </div>
              {score && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-bold text-foreground">{score}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
