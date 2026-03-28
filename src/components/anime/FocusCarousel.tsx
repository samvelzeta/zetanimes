import { useRef, useState } from "react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const items = animes.slice(0, 15);

  const scrollToIdx = (idx: number) => {
    const el = scrollRef.current;
    if (el?.children[idx]) {
      (el.children[idx] as HTMLElement).scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  };

  const go = (dir: number) => {
    let next = activeIdx + dir;
    // Wrap around
    if (next < 0) next = items.length - 1;
    if (next >= items.length) next = 0;
    setActiveIdx(next);
    scrollToIdx(next);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || !items.length) return;
    const containerRect = el.getBoundingClientRect();
    const centerX = containerRect.left + containerRect.width / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const rect = child.getBoundingClientRect();
      const childCenter = rect.left + rect.width / 2;
      const dist = Math.abs(childCenter - centerX);
      if (dist < closestDist) { closestDist = dist; closestIdx = i; }
    });
    setActiveIdx(closestIdx);
  };

  if (loading) {
    return (
      <section className="mb-8 px-4">
        <div className="h-5 w-40 bg-secondary rounded-md mb-4 animate-pulse" />
        <div className="h-72 bg-secondary rounded-xl animate-pulse" />
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-base font-bold text-foreground tracking-tight">
          {emoji && <span className="mr-1">{emoji}</span>}{title}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => go(-1)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={() => go(1)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
          {linkTo && (
            <Link to={linkTo} className="text-primary text-xs font-medium hover:underline">
              Ver todo →
            </Link>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-0 overflow-x-auto hide-scrollbar pb-4 px-4"
        style={{
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          scrollPaddingInline: "calc(50% - 100px)",
        }}
      >
        {items.map((anime, i) => {
          const isActive = i === activeIdx;
          const img = anime.coverImage?.extraLarge || anime.coverImage?.large;
          const score = anime.averageScore;

          return (
            <div
              key={anime.id}
              className="flex-shrink-0 transition-all duration-300 ease-out"
              style={{
                scrollSnapAlign: "center",
                scrollSnapStop: "always",
                width: "200px",
                transform: isActive ? "scale(1)" : "scale(0.65)",
                opacity: isActive ? 1 : 0.5,
                zIndex: isActive ? 10 : 1,
              }}
            >
              <Link to={`/anime/${anime.id}`} className="block group text-center">
                <div className="relative mx-auto overflow-hidden rounded-2xl aspect-[3/4] shadow-xl transition-shadow duration-300"
                  style={{ boxShadow: isActive ? "0 0 30px hsl(16 100% 50% / 0.4)" : "none" }}
                >
                  <img src={img} alt={getTitle(anime)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
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

      <div className="flex justify-center gap-1.5 mt-1">
        {items.slice(0, 10).map((_, i) => (
          <button key={i} onClick={() => { setActiveIdx(i); scrollToIdx(i); }}
            className={`transition-all duration-300 rounded-full ${i === activeIdx ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
