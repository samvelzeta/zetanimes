import { useRef } from "react";
import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import ZenLoader from "./ZenLoader";

interface Props {
  items: AniListMedia[];
  loading?: boolean;
}

/**
 * Cine ZetAnime — scroll horizontal editorial 21:9 con parallax ligero.
 */
export default function CinemaSection({ items, loading = false }: Props) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const list = items.slice(0, 12);

  return (
    <section className="relative mt-16 py-10 bg-gradient-to-b from-transparent via-zinc-900/40 to-transparent">
      <div className="px-4 md:px-8 mb-5">
        <p className="text-[10px] tracking-[0.4em] uppercase text-primary/80">
          Sesión especial
        </p>
        <h2 className="directory-hero-title text-xl md:text-3xl font-bold text-foreground mt-1">
          Cine ZetAnime
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Una selección cinematográfica para dejarse llevar.
        </p>
      </div>

      {loading ? (
        <div className="px-4 md:px-8 flex justify-center py-8">
          <ZenLoader size={36} />
        </div>
      ) : list.length === 0 ? null : (
        <div
          ref={scrollerRef}
          className="cinema-scroller flex gap-4 md:gap-5 overflow-x-auto snap-x snap-mandatory px-4 md:px-8 pb-4 scrollbar-thin"
        >
          {list.map((a) => {
            const title = getTitle(a);
            const img =
              a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || "";
            return (
              <Link
                key={a.id}
                to={`/anime/${a.id}`}
                className="cinema-card group relative snap-start flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-secondary"
                style={{
                  width: "min(78vw, 640px)",
                  aspectRatio: "21 / 9",
                }}
              >
                <LazyImage
                  src={img}
                  alt={title}
                  className="cinema-img w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-6 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="directory-hero-title text-base md:text-2xl font-bold text-white line-clamp-2">
                      {title}
                    </h3>
                    {a.seasonYear && (
                      <p className="text-[10px] md:text-xs text-white/70 mt-0.5">
                        {a.seasonYear}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/90 border border-white/40 rounded-full px-3 py-1.5 backdrop-blur-sm group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all">
                    <Play className="w-3.5 h-3.5 fill-current" /> Ver ahora
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
