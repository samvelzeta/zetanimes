import { useState, useMemo, useCallback } from "react";
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
  const [animating, setAnimating] = useState(false);
  const [animDir, setAnimDir] = useState<"in" | "out">("in");

  const getWrapped = (idx: number) => {
    const len = items.length;
    if (len === 0) return 0;
    return ((idx % len) + len) % len;
  };

  const getItem = (idx: number) => {
    if (items.length === 0) return null;
    return items[getWrapped(idx)];
  };

  const go = useCallback((dir: number) => {
    if (animating) return;
    setAnimating(true);
    setAnimDir("out");
    setTimeout(() => {
      setActiveIdx((prev) => prev + dir);
      setAnimDir("in");
      setTimeout(() => setAnimating(false), 350);
    }, 300);
  }, [animating]);

  if (loading) {
    return (
      <section className="mb-8 px-4">
        <div className="h-5 w-40 bg-secondary rounded-md mb-4 animate-pulse" />
        <div className="h-64 bg-secondary rounded-xl animate-pulse" />
      </section>
    );
  }

  if (!items.length) return null;

  const activeAnime = getItem(activeIdx);
  const leftAnime = getItem(activeIdx - 1);
  const rightAnime = getItem(activeIdx + 1);
  const activeImg = activeAnime?.coverImage?.extraLarge || activeAnime?.coverImage?.large;
  const leftImg = leftAnime?.coverImage?.extraLarge || leftAnime?.coverImage?.large;
  const rightImg = rightAnime?.coverImage?.extraLarge || rightAnime?.coverImage?.large;
  const size = 200;
  const sideSize = 120;

  const centerScale = animDir === "out" ? "scale-0 opacity-0" : "scale-100 opacity-100";

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
        <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 hover:scale-110 transition-all duration-300">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex justify-center items-center py-6 px-4 overflow-hidden gap-6" style={{ minHeight: "300px" }}>
          {/* Left side sphere */}
          {leftAnime && (
            <div className="flex flex-col items-center opacity-40 flex-shrink-0" style={{ width: `${sideSize}px` }}>
              <Link to={`/anime/${leftAnime.id}`} className="block text-center">
                {variant === "circle" ? (
                  <div className="mx-auto rounded-full overflow-hidden" style={{ width: `${sideSize}px`, height: `${sideSize}px`, boxShadow: "0 0 15px hsl(16 100% 50% / 0.2)" }}>
                    <img src={leftImg} alt={getTitle(leftAnime)} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden ring-1 ring-primary/20" style={{ width: `${sideSize}px`, height: `${sideSize * 1.4}px` }}>
                    <img src={leftImg} alt={getTitle(leftAnime)} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <p className="mt-2 text-[10px] font-semibold text-muted-foreground line-clamp-1">{getTitle(leftAnime)}</p>
              </Link>
            </div>
          )}

          {/* Center active item with scale animation */}
          {activeAnime && (
            <div
              className={`flex flex-col items-center transition-all duration-300 ease-out flex-shrink-0 ${centerScale}`}
              style={{ width: `${size}px` }}
            >
              <Link to={`/anime/${activeAnime.id}`} className="block group text-center">
                {variant === "circle" ? (
                  <div
                    className="mx-auto rounded-full overflow-hidden relative"
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      boxShadow: "0 0 30px hsl(16 100% 50% / 0.5), 0 0 0 3px hsl(16 100% 50% / 0.6)",
                    }}
                  >
                    <img src={activeImg} alt={getTitle(activeAnime)} className="w-full h-full object-cover" loading="lazy" />
                    {/* Spinning glowing border line */}
                    <div className="absolute inset-[-5px] rounded-full animate-[sphere-spin_2.5s_linear_infinite]" style={{
                      border: "3px solid transparent",
                      borderTopColor: "hsl(16 100% 55%)",
                      borderRightColor: "hsl(16 100% 55% / 0.2)",
                      filter: "drop-shadow(0 0 6px hsl(16 100% 55%))",
                    }} />
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden ring-2 ring-primary/40" style={{ width: `${size}px`, height: `${size * 1.4}px` }}>
                    <img src={activeImg} alt={getTitle(activeAnime)} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="mt-3 text-center">
                  <p className="text-sm font-bold text-foreground">{getTitle(activeAnime)}</p>
                  {activeAnime.genres && <p className="text-[10px] text-muted-foreground mt-0.5">{activeAnime.genres.slice(0, 3).join(" · ")}</p>}
                </div>
              </Link>
            </div>
          )}

          {/* Right side sphere */}
          {rightAnime && (
            <div className="flex flex-col items-center opacity-40 flex-shrink-0" style={{ width: `${sideSize}px` }}>
              <Link to={`/anime/${rightAnime.id}`} className="block text-center">
                {variant === "circle" ? (
                  <div className="mx-auto rounded-full overflow-hidden" style={{ width: `${sideSize}px`, height: `${sideSize}px`, boxShadow: "0 0 15px hsl(16 100% 50% / 0.2)" }}>
                    <img src={rightImg} alt={getTitle(rightAnime)} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden ring-1 ring-primary/20" style={{ width: `${sideSize}px`, height: `${sideSize * 1.4}px` }}>
                    <img src={rightImg} alt={getTitle(rightAnime)} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                )}
                <p className="mt-2 text-[10px] font-semibold text-muted-foreground line-clamp-1">{getTitle(rightAnime)}</p>
              </Link>
            </div>
          )}
        </div>

        <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 hover:scale-110 transition-all duration-300">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {items.map((_, i) => (
          <button key={i} onClick={() => { if (!animating) { setAnimating(true); setAnimDir("out"); setTimeout(() => { setActiveIdx(i); setAnimDir("in"); setTimeout(() => setAnimating(false), 350); }, 300); } }}
            className={`transition-all duration-300 rounded-full ${getWrapped(activeIdx) === i ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
