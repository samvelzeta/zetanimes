import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import ZetMascot from "./ZetMascot";

/** Skeleton con shimmer + mascota flotante para el grid Bento. */
export function BentoSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl directory-shimmer ${
        hero ? "col-span-2 row-span-2" : ""
      }`}
      style={{ aspectRatio: hero ? "1 / 1" : "2 / 3" }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <ZetMascot className="w-10 h-10 directory-mascot" />
      </div>
    </div>
  );
}

interface Props {
  anime: AniListMedia;
  hero?: boolean;
  className?: string;
}

export default function BentoAnimeCard({ anime, hero = false, className = "" }: Props) {
  const title = getTitle(anime);
  const img =
    (hero && anime.bannerImage) ||
    anime.coverImage?.extraLarge ||
    anime.coverImage?.large ||
    "";
  const desc = (anime.description || "").replace(/<[^>]+>/g, "").slice(0, 90);

  return (
    <Link
      to={`/anime/${anime.id}`}
      className={`group directory-card relative block overflow-hidden rounded-2xl bg-secondary ${
        hero ? "col-span-2 row-span-2" : ""
      } ${className}`}
      style={hero ? undefined : { aspectRatio: "2 / 3" }}
    >
      <LazyImage
        src={img}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />

      {/* Overlay — móvil siempre visible, desktop en hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500" />

      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 md:opacity-0 md:group-hover:opacity-100 md:translate-y-4 md:group-hover:translate-y-0 transition-all duration-500">
        <h3
          className={`font-bold text-white leading-tight line-clamp-2 ${
            hero ? "text-lg sm:text-2xl directory-hero-title" : "text-sm"
          }`}
        >
          {title}
        </h3>
        {desc && (
          <p className="mt-1 text-[11px] sm:text-xs text-white/70 line-clamp-2 hidden md:block">
            {desc}
          </p>
        )}
        {/* Sinopsis móvil colapsada a 2 líneas */}
        {desc && (
          <p className="mt-1 text-[11px] text-white/70 line-clamp-2 md:hidden">
            {desc}
          </p>
        )}
      </div>

      {/* Play flotante hover desktop */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center backdrop-blur-sm">
          <Play className="w-5 h-5 text-primary-foreground fill-current ml-0.5" />
        </div>
      </div>
    </Link>
  );
}
