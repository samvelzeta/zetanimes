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
 * CinemaAccordion — sección "Cine ZetAnime" con acordeón horizontal.
 * Desktop: al hover un ítem se expande, los demás se comprimen.
 * Mobile: fallback a scroll horizontal snap.
 */
export default function CinemaAccordion({ items, loading = false }: Props) {
  const list = items.slice(0, 6);

  return (
    <section className="relative mt-16 py-10">
      <div className="px-4 md:px-8 mb-6 text-center md:text-left">
        <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Sesión especial</p>
        <h2 className="directory-hero-title text-2xl md:text-4xl font-bold text-foreground mt-1">
          Cine ZetAnime
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-2 max-w-xl md:mx-0 mx-auto">
          Pasa el cursor para descubrir cada estreno.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <ZenLoader size={36} />
        </div>
      ) : list.length === 0 ? null : (
        <>
          {/* Desktop accordion */}
          <div className="cinema-accordion hidden md:block mx-auto">
            <ul>
              {list.map((a) => {
                const title = getTitle(a);
                const img = a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || "";
                return (
                  <li key={a.id}>
                    <Link to={`/anime/${a.id}`} className="cinema-accordion-item">
                      <LazyImage src={img} alt={title} className="cinema-accordion-img" />
                      <div className="cinema-accordion-overlay">
                        <div className="cinema-accordion-caption">
                          <h3 className="directory-hero-title text-white text-xl font-bold line-clamp-2">
                            {title}
                          </h3>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-white/75">
                            {a.seasonYear && <span>{a.seasonYear}</span>}
                            {a.averageScore && (
                              <span className="text-primary font-mono">
                                ★ {(a.averageScore / 10).toFixed(1)}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 ml-auto">
                              <Play className="w-3 h-3 fill-current" /> Ver
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mobile fallback: horizontal snap */}
          <div className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory px-4 pb-4 scrollbar-thin">
            {list.map((a) => {
              const title = getTitle(a);
              const img = a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || "";
              return (
                <Link
                  key={a.id}
                  to={`/anime/${a.id}`}
                  className="relative snap-start flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-secondary"
                  style={{ width: "78vw", aspectRatio: "16 / 10" }}
                >
                  <LazyImage src={img} alt={title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="directory-hero-title text-white text-base font-bold line-clamp-2">
                      {title}
                    </h3>
                    {a.seasonYear && (
                      <p className="text-[10px] text-white/70 mt-0.5">{a.seasonYear}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
