import { Link } from "react-router-dom";
import { Sparkles, Star, Calendar, TrendingUp } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  anime: AniListMedia;
  index?: number;
}

/**
 * "Perfil de Intriga" — tarjeta editorial que rompe el grid con storytelling.
 * En desktop ocupa 2 columnas (span 2). En móvil ocupa 2 columnas también (full-row del grid 2-col).
 */
export default function StoryCard({ anime, index = 0 }: Props) {
  const title = getTitle(anime);
  const desc = (anime.description || "")
    .replace(/<[^>]+>/g, "")
    .trim();
  const cover =
    anime.coverImage?.extraLarge || anime.coverImage?.large || "";
  const banner = anime.bannerImage || cover;
  const year = anime.seasonYear;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const mainGenre = anime.genres?.[0];
  const trending = (anime.popularity ?? 0) > 100000;

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="story-card group relative col-span-2 xl:col-span-2 block overflow-hidden rounded-2xl bg-secondary border border-primary/15 hover:border-primary/50 transition-colors"
      style={{
        aspectRatio: "16 / 9",
        animationDelay: `${(index % 5) * 60}ms`,
      }}
    >
      {/* Fondo banner difuminado */}
      <LazyImage
        src={banner}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[3px] scale-110 group-hover:scale-125 transition-transform duration-700"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />

      <div className="relative h-full flex items-stretch">
        {/* Portada */}
        <div className="w-[40%] max-w-[220px] flex-shrink-0 p-3 md:p-4">
          <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl">
            <LazyImage src={cover} alt={title} className="w-full h-full object-cover" />
            <div className="absolute top-2 left-2 directory-glass px-2 py-1 rounded-full flex items-center gap-1 text-[10px] text-white font-semibold">
              <Sparkles className="w-3 h-3 text-primary" />
              Descubre
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="flex-1 min-w-0 p-3 md:p-5 flex flex-col justify-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-primary/80 mb-1.5">
            Perfil de intriga
          </p>
          <h3 className="directory-hero-title text-base md:text-2xl font-bold text-foreground line-clamp-2 leading-tight">
            {title}
          </h3>
          {desc && (
            <p className="mt-2 text-[11px] md:text-sm text-muted-foreground line-clamp-3 md:line-clamp-4 leading-relaxed">
              {desc}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {score && (
              <span className="inline-flex items-center gap-1 text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
                <Star className="w-3 h-3 fill-current" /> {score}
              </span>
            )}
            {year && (
              <span className="inline-flex items-center gap-1 text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-white/5 text-foreground/80">
                <Calendar className="w-3 h-3" /> {year}
              </span>
            )}
            {mainGenre && (
              <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-white/5 text-foreground/70">
                {mainGenre}
              </span>
            )}
            {trending && (
              <span className="inline-flex items-center gap-1 text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary/90">
                <TrendingUp className="w-3 h-3" /> Trending
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
