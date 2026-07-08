import { Link } from "react-router-dom";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import ZenLoader from "./ZenLoader";

export type AsymmetricVariant = "portrait" | "square" | "landscape";

const ASPECTS: Record<AsymmetricVariant, string> = {
  portrait: "2 / 3",
  square: "1 / 1",
  landscape: "16 / 9",
};

export function AsymmetricSkeleton({ variant = "portrait" }: { variant?: AsymmetricVariant }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl directory-shimmer"
      style={{ aspectRatio: ASPECTS[variant] }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <ZenLoader size={36} className="text-primary" />
      </div>
    </div>
  );
}

interface Props {
  anime: AniListMedia;
  variant?: AsymmetricVariant;
}

export default function AsymmetricCard({ anime, variant = "portrait" }: Props) {
  const title = getTitle(anime);
  // landscape / square prefiere banner; portrait usa cover
  const useBanner = variant !== "portrait" && anime.bannerImage;
  const img =
    (useBanner ? anime.bannerImage : anime.coverImage?.extraLarge || anime.coverImage?.large) || "";
  const desc = (anime.description || "").replace(/<[^>]+>/g, "").slice(0, 100);

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="group directory-card relative block overflow-hidden rounded-2xl bg-secondary"
      style={{ aspectRatio: ASPECTS[variant] }}
    >
      <LazyImage
        src={img}
        alt={title}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500" />
      <div className="absolute inset-x-0 bottom-0 p-3 md:p-4 md:translate-y-3 md:group-hover:translate-y-0 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500">
        <h3 className={`font-bold text-white leading-tight line-clamp-2 ${variant === "landscape" ? "text-base md:text-lg" : "text-sm"}`}>
          {title}
        </h3>
        {desc && variant !== "portrait" && (
          <p className="mt-1 text-[11px] text-white/70 line-clamp-2">{desc}</p>
        )}
      </div>
    </Link>
  );
}
