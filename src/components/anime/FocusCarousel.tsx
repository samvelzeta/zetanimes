import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Star, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  title: string;
  emoji?: string;
  animes: AniListMedia[];
  loading?: boolean;
  linkTo?: string;
}

export default function FocusCarousel({ title, emoji, animes, loading, linkTo }: Props) {
  const items = animes.slice(0, 15);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const go = useCallback((dir: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setActiveIdx((prev) => {
      let next = prev + dir;
      if (next < 0) next = items.length - 1;
      if (next >= items.length) next = 0;
      return next;
    });
    setTimeout(() => setIsTransitioning(false), 500);
  }, [items.length, isTransitioning]);

  // Autoplay
  const interactionRef = useRef(false);
  useEffect(() => {
    if (items.length <= 1) return;
    const interval = setInterval(() => {
      if (!interactionRef.current) {
        go(1);
      }
      interactionRef.current = false;
    }, 5000);
    return () => clearInterval(interval);
  }, [items.length, go]);

  const handleUserInteraction = () => { interactionRef.current = true; };

  if (loading) {
    return (
      <section className="mb-8 px-4">
        <div className="h-5 w-40 bg-secondary rounded-md mb-4 animate-pulse" />
        <div className="h-72 bg-secondary rounded-xl animate-pulse" />
      </section>
    );
  }

  if (!items.length) return null;

  const getWrappedIndex = (offset: number) => {
    return ((activeIdx + offset) % items.length + items.length) % items.length;
  };

  const visibleOffsets = [-2, -1, 0, 1, 2];

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-base font-bold text-foreground tracking-tight">
          {emoji && <span className="mr-1">{emoji}</span>}{title}
        </h2>
        <div className="flex items-center gap-2">
          {linkTo && (
            <Link to={linkTo} className="text-primary text-xs font-medium hover:underline">
              Ver todo →
            </Link>
          )}
        </div>
      </div>

      <div className="relative">
        {/* Left nav button */}
        <button
          onClick={() => { handleUserInteraction(); go(-1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 hover:scale-110 transition-all duration-300"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex justify-center items-center gap-0 py-4 px-4 overflow-hidden" style={{ minHeight: "340px" }}>
          {visibleOffsets.map((offset) => {
            const idx = getWrappedIndex(offset);
            const anime = items[idx];
            const isActive = offset === 0;
            const img = anime.coverImage?.extraLarge || anime.coverImage?.large;
            const score = anime.averageScore;
            const absOffset = Math.abs(offset);

            return (
              <div
                key={`${idx}-${offset}`}
                className="flex-shrink-0 will-change-transform"
                style={{
                  width: "200px",
                  transform: isActive ? "scale(1)" : absOffset === 1 ? "scale(0.75)" : "scale(0.55)",
                  opacity: isActive ? 1 : absOffset === 1 ? 0.6 : 0.3,
                  zIndex: isActive ? 10 : 5 - absOffset,
                  marginLeft: offset === -2 ? 0 : "-20px",
                  transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                <Link to={`/anime/${anime.id}`} className="block group text-center">
                  <div className="relative mx-auto overflow-hidden rounded-2xl aspect-[3/4] shadow-xl"
                    style={{
                      boxShadow: isActive ? "0 0 30px hsl(16 100% 50% / 0.4)" : "none",
                      transition: "box-shadow 0.5s ease",
                    }}
                  >
                    <img src={img} alt={getTitle(anime)} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
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
                    <div className="absolute bottom-2 left-2 right-2">
                      <p className="text-xs font-bold text-white line-clamp-2">{getTitle(anime)}</p>
                      {anime.genres && <p className="text-[9px] text-white/50 mt-0.5">{anime.genres.slice(0, 2).join(" · ")}</p>}
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Right nav button */}
        <button
          onClick={() => { handleUserInteraction(); go(1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 hover:scale-110 transition-all duration-300"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      <div className="flex justify-center gap-1.5 mt-1">
        {items.slice(0, 10).map((_, i) => (
          <button key={i} onClick={() => { if (!isTransitioning) setActiveIdx(i); }}
            className={`transition-all duration-300 rounded-full ${i === activeIdx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
