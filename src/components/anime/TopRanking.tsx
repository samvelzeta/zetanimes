import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import AdBanner300x250 from "@/components/ads/AdBanner300x250";

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
          <div key={i} className="h-20 bg-secondary rounded-xl mb-2 animate-pulse" />
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
          const img = anime.coverImage?.large || anime.coverImage?.extraLarge;
          return (
            <Link
              key={anime.id}
              to={`/anime/${anime.id}`}
              className={`group flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-secondary/80 ${isTop3 ? "bg-secondary border border-primary/20" : "bg-secondary/50"}`}
            >
              {/* Big rank number */}
              <div className="flex-shrink-0 w-12 flex items-center justify-center">
                <span className={`text-3xl font-black leading-none ${isTop3 ? "text-primary" : "text-muted-foreground/30"}`}>
                  {i + 1}
                </span>
              </div>

              {/* Cover image */}
              <div className="flex-shrink-0 w-14 h-[72px] rounded-lg overflow-hidden ring-1 ring-border">
                <img src={img} alt={getTitle(anime)} className="w-full h-full object-cover" loading="lazy" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {getTitle(anime)}
                </p>
                {anime.genres && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {anime.genres.slice(0, 3).join(" · ")}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isTop3 ? "bg-primary" : "bg-muted-foreground/40"}`}
                      style={{ width: `${anime.averageScore || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Score */}
              {score && (
                <div className="flex items-center gap-1 flex-shrink-0 bg-black/20 rounded-lg px-2 py-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-black text-foreground">{score}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
      {/* Banner Adsterra debajo del Top 10 */}
      <AdBanner300x250 />
    </section>
  );
}
