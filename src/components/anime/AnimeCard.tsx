import { Link } from "react-router-dom";
import { getTitle, getStatusLabel, getStatusColor, type AniListMedia } from "@/lib/anilist";
import { Star, Play } from "lucide-react";
import LazyImage from "@/components/LazyImage";

interface AnimeCardProps {
  anime: AniListMedia;
  showStatus?: boolean;
  size?: "small" | "default" | "large" | "grid";
}

export default function AnimeCard({ anime, showStatus = false, size = "default" }: AnimeCardProps) {
  const title = getTitle(anime);
  const image = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const score = anime.averageScore;

  const sizeClasses: Record<string, string> = {
    small: "w-28 flex-shrink-0",
    default: "w-36 flex-shrink-0",
    large: "w-44 flex-shrink-0",
    grid: "w-full",
  };

  return (
    <Link to={`/anime/${anime.id}`} className={`group block ${sizeClasses[size]}`}>
      <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-secondary neon-card">
        <LazyImage src={image || ""} alt={title} className="w-full h-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-4 h-4 text-primary-foreground fill-current ml-0.5" />
          </div>
        </div>
        {showStatus && anime.status && (
          <span className={`absolute top-2 left-2 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md text-primary-foreground ${getStatusColor(anime.status)}`}>
            {getStatusLabel(anime.status)}
          </span>
        )}
        {score && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm rounded-md px-1.5 py-0.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] font-semibold text-white">{(score / 10).toFixed(1)}</span>
          </div>
        )}
        {anime.nextAiringEpisode && (
          <div className="absolute bottom-2 left-2 right-2 bg-primary/90 backdrop-blur-sm rounded-md px-2 py-1">
            <span className="text-[9px] font-bold text-primary-foreground">EP {anime.nextAiringEpisode.episode} PRÓXIMAMENTE</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs font-medium text-muted-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors">{title}</p>
    </Link>
  );
}

