import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  title: string;
  animes: AniListMedia[];
  loading?: boolean;
  linkTo?: string;
  variant?: "circle" | "card";
}

export default function SphereCarousel({ title, animes, loading, linkTo, variant = "circle" }: Props) {
  const items = useMemo(() => animes.slice(0, 12), [animes]);
  const [activeIdx, setActiveIdx] = useState(0);

  // Infinite scroll: wrap around
  const getItem = (idx: number) => {
    const len = items.length;
    if (len === 0) return null;
    return items[((idx % len) + len) % len];
  };

  const go = (dir: number) => {
    setActiveIdx((prev) => prev + dir);
  };

  if (loading) {
    return (
      <section className="mb-8 px-4">
        <div className="h-5 w-40 bg-secondary rounded-md mb-4 animate-pulse" />
        <div className="h-64 bg-secondary rounded-xl animate-pulse" />
      </section>
    );
  }

  if (!items.length) return null;

  // Show 3 visible: left, center, right
  const visibleIndices = [activeIdx - 1, activeIdx, activeIdx + 1];

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="text-primary text-xs font-medium hover:underline">
            Ver todo →
          </Link>
        )}
      </div>

      <div className="relative">
        <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex justify-center items-center gap-0 py-6 px-4 overflow-hidden" style={{ minHeight: "260px" }}>
          {visibleIndices.map((idx) => {
            const anime = getItem(idx);
            if (!anime) return null;
            const isActive = idx === activeIdx;
            const img = anime.coverImage?.extraLarge || anime.coverImage?.large;
            const size = isActive ? 200 : 120;

            return (
              <div
                key={`${anime.id}-${idx}`}
                className="flex-shrink-0 transition-all duration-500 ease-out flex flex-col items-center"
                style={{
                  width: `${size}px`,
                  transform: isActive ? "scale(1)" : "scale(0.75)",
                  opacity: isActive ? 1 : 0.4,
                  zIndex: isActive ? 10 : 1,
                }}
              >
                <Link to={`/anime/${anime.id}`} className="block group text-center">
                  {variant === "circle" ? (
                    <div
                      className="mx-auto rounded-full overflow-hidden transition-all duration-500"
                      style={{
                        width: `${size}px`,
                        height: `${size}px`,
                        boxShadow: isActive ? "0 0 30px hsl(16 100% 50% / 0.5), 0 0 0 3px hsl(16 100% 50% / 0.6)" : "none",
                      }}
                    >
                      <img src={img} alt={getTitle(anime)} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  ) : (
                    <div className="rounded-2xl overflow-hidden ring-2 ring-primary/40 transition-all duration-500" style={{ width: `${size}px`, height: `${size * 1.4}px` }}>
                      <img src={img} alt={getTitle(anime)} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  {isActive && (
                    <div className="mt-3 text-center">
                      <p className="text-sm font-bold text-foreground">{getTitle(anime)}</p>
                      {anime.genres && <p className="text-[10px] text-muted-foreground mt-0.5">{anime.genres.slice(0, 3).join(" · ")}</p>}
                    </div>
                  )}
                </Link>
              </div>
            );
          })}
        </div>

        <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {items.map((_, i) => (
          <button key={i} onClick={() => setActiveIdx(i)}
            className={`transition-all duration-300 rounded-full ${((activeIdx % items.length) + items.length) % items.length === i ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
