import { forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRecentlyUpdated, getTitle, type AniListMedia } from "@/lib/anilist";
import { Play, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdCard from "@/components/ads/AdCard";
import LazyImage from "@/components/LazyImage";

export default function BentoEpisodes() {
  const { isPremium } = useAuth();
  // Si es free pedimos solo 4 (último cuadro = anuncio). Premium pide 5 normal.
  const fetchCount = isPremium ? 5 : 4;
  const { data, isLoading } = useQuery({
    queryKey: ["recentlyUpdated", fetchCount],
    queryFn: () => getRecentlyUpdated(1, fetchCount),
    staleTime: 1000 * 60 * 5,
  });

  const items = data?.media || [];

  if (isLoading) {
    return (
      <section className="px-4 mb-8">
        <h2 className="text-base font-bold text-foreground tracking-tight mb-3">🔥 Nuevos Episodios</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-[180px]">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className={`bg-secondary rounded-xl animate-pulse ${i === 0 ? "col-span-2 row-span-2" : ""}`} />
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  const [hero, ...rest] = items;

  return (
    <section className="px-4 mb-8">
      <h2 className="text-base font-bold text-foreground tracking-tight mb-3">🔥 Nuevos Episodios</h2>
      {/* 4-col grid: hero takes 2x2, then cards fill remaining cells. Free: la última (esquina inferior derecha) es anuncio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 auto-rows-[180px]">
        <BentoCard anime={hero} isHero className="col-span-2 row-span-2" />
        {rest.slice(0, isPremium ? 4 : 3).map((anime) => (
          <BentoCard key={anime.id} anime={anime} />
        ))}
        {!isPremium && (
          <div className="relative overflow-hidden rounded-xl bg-secondary neon-card flex items-center justify-center">
            <div className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&_.aspect-\[3\/4\]]:!aspect-auto [&_.aspect-\[3\/4\]]:!h-full">
              <AdCard size="default" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const BentoCard = forwardRef<
  HTMLAnchorElement,
  { anime: AniListMedia; isHero?: boolean; className?: string }
>(function BentoCard({ anime, isHero = false, className = "" }, ref) {
  const title = getTitle(anime);
  const image = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large;
  const score = anime.averageScore;

  return (
    <Link ref={ref} to={`/anime/${anime.id}`} className={`group relative overflow-hidden rounded-xl bg-secondary neon-card ${className}`}>
      <LazyImage src={image!} alt={title} className="w-full h-full transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm">
          <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
        </div>
      </div>
      {score && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] font-semibold text-white">{(score / 10).toFixed(1)}</span>
        </div>
      )}
      {anime.nextAiringEpisode && (
        <div className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm rounded-md px-2 py-0.5">
          <span className="text-[9px] font-bold text-primary-foreground uppercase">EN EMISIÓN</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className={`font-bold text-white leading-tight ${isHero ? "text-lg" : "text-xs"} line-clamp-2`}>{title}</p>
        {isHero && anime.genres && <p className="text-[10px] text-white/50 mt-1">{anime.genres.slice(0, 3).join(" • ")}</p>}
        {isHero && (
          <button className="mt-2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1.5 rounded-lg inline-flex items-center gap-1">
            <Play className="w-3 h-3 fill-current" /> Ver Ahora
          </button>
        )}
      </div>
    </Link>
  );
});
export { BentoCard };
