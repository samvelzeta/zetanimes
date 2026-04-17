import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import { useIsTV } from "@/hooks/useIsTV";
import { useInViewport } from "@/hooks/useInViewport";
import LazyImage from "@/components/LazyImage";

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
  const [visible, setVisible] = useState(true);
  const isTV = useIsTV();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInViewport(sectionRef, "200px");

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
    // Lighter animation: shrink to 50% then swap
    setVisible(false);
    setTimeout(() => {
      setActiveIdx((prev) => prev + dir);
      setVisible(true);
      setTimeout(() => setAnimating(false), isTV ? 150 : 300);
    }, isTV ? 150 : 250);
  }, [animating, isTV]);

  // Autoplay
  const interactionRef = useRef(false);
  useEffect(() => {
    if (items.length <= 1 || !inView) return;
    const interval = setInterval(() => {
      if (!interactionRef.current) go(1);
      interactionRef.current = false;
    }, 5000);
    return () => clearInterval(interval);
  }, [items.length, go, inView]);

  const handleUserInteraction = () => { interactionRef.current = true; };

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
  // Thumbnails laterales: usar versión 'large' (más liviana)
  const leftImg = leftAnime?.coverImage?.large || leftAnime?.coverImage?.extraLarge;
  const rightImg = rightAnime?.coverImage?.large || rightAnime?.coverImage?.extraLarge;
  const size = 200;
  const sideSize = 120;

  // Lighter transition: scale to 50% instead of 0, then fade
  const centerStyle: React.CSSProperties = {
    transform: visible ? "scale(1)" : "scale(0.5)",
    opacity: visible ? 1 : 0,
    transition: isTV ? "transform 0.15s ease, opacity 0.15s ease" : "transform 0.3s ease-out, opacity 0.25s ease-out",
  };

  return (
    <section ref={sectionRef} className="mb-8">
      <div className="flex items-center justify-between px-4 mb-4">
        <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
        {linkTo && (
          <Link to={linkTo} className="text-primary text-xs font-medium hover:underline">
            Ver todo →
          </Link>
        )}
      </div>

      <div className="relative">
        <button onClick={() => { handleUserInteraction(); go(-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 hover:scale-110 transition-all duration-300">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex justify-center items-center py-6 px-4 overflow-hidden gap-6" style={{ minHeight: "300px" }}>
          {/* Left */}
          {leftAnime && (
            <div className="flex flex-col items-center opacity-40 flex-shrink-0" style={{ width: `${sideSize}px` }}>
              <Link to={`/anime/${leftAnime.id}`} className="block text-center">
                {variant === "circle" ? (
                  <div className="mx-auto rounded-full overflow-hidden" style={{ width: `${sideSize}px`, height: `${sideSize}px`, boxShadow: "0 0 15px hsl(var(--primary) / 0.2)" }}>
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

          {/* Center */}
          {activeAnime && (
            <div className="flex flex-col items-center flex-shrink-0" style={{ width: `${size}px`, ...centerStyle }}>
              <Link to={`/anime/${activeAnime.id}`} className="block group text-center">
                {variant === "circle" ? (
                  <div className="mx-auto rounded-full overflow-hidden relative" style={{ width: `${size}px`, height: `${size}px` }}>
                    <img src={activeImg} alt={getTitle(activeAnime)} className="w-full h-full object-cover" loading="lazy" />
                    {/* Anillo giratorio neon — más brillante */}
                    {!isTV && (
                      <div className="absolute inset-[-7px] rounded-full animate-[sphere-spin_2.5s_linear_infinite]" style={{
                        border: "4px solid transparent",
                        borderTopColor: "hsl(var(--primary))",
                        borderRightColor: "hsl(var(--primary) / 0.5)",
                        filter: "drop-shadow(0 0 14px hsl(var(--primary))) drop-shadow(0 0 28px hsl(var(--primary) / 0.7))",
                      }} />
                    )}
                    {/* Halo exterior MUY luminoso */}
                    <div className="absolute inset-[-4px] rounded-full pointer-events-none" style={{
                      boxShadow: "0 0 40px hsl(var(--primary) / 0.9), 0 0 80px hsl(var(--primary) / 0.5), 0 0 120px hsl(var(--primary) / 0.25), inset 0 0 20px hsl(var(--primary) / 0.2)",
                    }} />
                    {/* Pulso adicional para dar vida */}
                    {!isTV && (
                      <div className="absolute inset-[-10px] rounded-full pointer-events-none animate-pulse" style={{
                        boxShadow: "0 0 30px hsl(var(--primary) / 0.6)",
                      }} />
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden ring-2 ring-primary/60 relative" style={{ width: `${size}px`, height: `${size * 1.4}px`, boxShadow: "0 0 30px hsl(var(--primary) / 0.7), 0 0 60px hsl(var(--primary) / 0.35)" }}>
                    <img src={activeImg} alt={getTitle(activeAnime)} className="w-full h-full object-cover" loading="lazy" />
                    {/* Loading ring para card variant — más brillante */}
                    {!isTV && (
                      <div className="absolute inset-[-5px] rounded-2xl animate-[sphere-spin_3s_linear_infinite]" style={{
                        border: "3px solid transparent",
                        borderTopColor: "hsl(var(--primary))",
                        filter: "drop-shadow(0 0 12px hsl(var(--primary))) drop-shadow(0 0 24px hsl(var(--primary) / 0.6))",
                      }} />
                    )}
                  </div>
                )}
                <div className="mt-3 text-center">
                  <p className="text-sm font-bold text-foreground">{getTitle(activeAnime)}</p>
                  {activeAnime.genres && <p className="text-[10px] text-muted-foreground mt-0.5">{activeAnime.genres.slice(0, 3).join(" · ")}</p>}
                </div>
              </Link>
            </div>
          )}

          {/* Right */}
          {rightAnime && (
            <div className="flex flex-col items-center opacity-40 flex-shrink-0" style={{ width: `${sideSize}px` }}>
              <Link to={`/anime/${rightAnime.id}`} className="block text-center">
                {variant === "circle" ? (
                  <div className="mx-auto rounded-full overflow-hidden" style={{ width: `${sideSize}px`, height: `${sideSize}px`, boxShadow: "0 0 15px hsl(var(--primary) / 0.2)" }}>
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

        <button onClick={() => { handleUserInteraction(); go(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 hover:scale-110 transition-all duration-300">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {items.map((_, i) => (
          <button key={i} onClick={() => {
            if (!animating) {
              setAnimating(true);
              setVisible(false);
              setTimeout(() => { setActiveIdx(i); setVisible(true); setTimeout(() => setAnimating(false), isTV ? 150 : 300); }, isTV ? 150 : 250);
            }
          }}
            className={`transition-all duration-300 rounded-full ${getWrapped(activeIdx) === i ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
