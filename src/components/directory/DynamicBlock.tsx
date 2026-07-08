import { Link } from "react-router-dom";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import ZenLoader from "./ZenLoader";

/**
 * DynamicBlock — tarjeta de altura natural para layout masonry (columns CSS).
 * Sin aspect-ratio fijo: usa la proporción natural del cover para eliminar aire vertical.
 * `feature` amplía tipografía cuando el score es alto o el título es "hero".
 */
interface Props {
  anime: AniListMedia;
  feature?: boolean;
}

export function DynamicBlockSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className="block break-inside-avoid mb-3 md:mb-4 relative overflow-hidden rounded-2xl directory-shimmer"
      style={{ aspectRatio: tall ? "2 / 3" : "3 / 4" }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <ZenLoader size={32} className="text-primary" />
      </div>
    </div>
  );
}

export default function DynamicBlock({ anime, feature = false }: Props) {
  const title = getTitle(anime);
  // Usa banner si existe y merece formato panorámico (score alto/feature)
  const useBanner = feature && !!anime.bannerImage;
  const img =
    (useBanner ? anime.bannerImage : anime.coverImage?.extraLarge || anime.coverImage?.large) || "";
  const year = anime.seasonYear;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="dynamic-block group relative block break-inside-avoid mb-3 md:mb-4 overflow-hidden rounded-2xl bg-secondary"
    >
      <LazyImage
        src={img}
        alt={title}
        className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
        style={useBanner ? { aspectRatio: "16 / 9" } : undefined}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 md:translate-y-2 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500">
        <h3 className={`font-bold text-white leading-tight line-clamp-2 ${feature ? "text-base md:text-xl" : "text-sm"}`}>
          {title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-white/70">
          {score && <span className="text-primary font-mono">★ {score}</span>}
          {year && <span>{year}</span>}
        </div>
      </div>
    </Link>
  );
}
