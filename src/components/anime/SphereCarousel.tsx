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

  const getItem = (idx: number) => {
    const len = items.length;
    if (len === 0) return null;
    return items[((idx % len) + len) % len];
  };

  const go = useCallback((dir: number) => {
    if (animating) return;
    setAnimating(true);
    setAnimDir("out");
    // Scale out, then switch, then scale in
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
  const activeImg = activeAnime?.coverImage?.extraLarge || activeAnime?.coverImage?.large;
  const size = 200;

  // Scale/opacity based on animation state
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
        <button onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 transition-all duration-300">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex justify-center items-center py-6 px-4 overflow-hidden" style={{ minHeight: "280px" }}>
          {/* Single active item with scale animation */}
          {activeAnime && (
            <div
              className={`flex flex-col items-center transition-all duration-300 ease-out ${centerScale}`}
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
                    {/* Spinning border */}
                    <div className="absolute inset-[-4px] rounded-full animate-[sphere-spin_3s_linear_infinite]" style={{
                      border: "3px solid transparent",
                      borderTopColor: "hsl(16 100% 50%)",
                      borderRightColor: "hsl(16 100% 50% / 0.3)",
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
        </div>

        <button onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-primary/70 transition-all duration-300">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2">
        {items.map((_, i) => (
          <button key={i} onClick={() => { if (!animating) { setAnimating(true); setAnimDir("out"); setTimeout(() => { setActiveIdx(i); setAnimDir("in"); setTimeout(() => setAnimating(false), 350); }, 300); } }}
            className={`transition-all duration-300 rounded-full ${((activeIdx % items.length) + items.length) % items.length === i ? "w-5 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-muted-foreground/30"}`} />
        ))}
      </div>
    </section>
  );
}
