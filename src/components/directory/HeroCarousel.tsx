import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play, Info, Pause } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import LazyImage from "@/components/LazyImage";

interface Props {
  items: AniListMedia[];
}


export default function HeroCarousel({ items }: Props) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = items.slice(0, 6);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length, paused]);


  if (!slides.length) {
    return (
      <div className="relative w-full h-[40vh] md:h-[60vh] lg:h-[92vh] bg-secondary directory-shimmer rounded-b-3xl" />
    );
  }

  const go = (dir: -1 | 1) =>
    setIndex((i) => (i + dir + slides.length) % slides.length);

  return (
    <section className="relative w-full h-[40vh] md:h-[60vh] lg:h-[92vh] overflow-hidden rounded-b-3xl">
      {/* Firma DIRECTORIO */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8 z-20 pointer-events-none">
        <p className="text-[10px] sm:text-xs font-light tracking-[0.45em] text-white/60 uppercase drop-shadow">
          Directorio
        </p>
        <div className="mt-1 h-px w-10 bg-white/40" />
      </div>

      {slides.map((anime, i) => {
        const active = i === index;
        const img =
          anime.bannerImage ||
          anime.coverImage?.extraLarge ||
          anime.coverImage?.large ||
          "";
        const title = getTitle(anime);
        const desc = (anime.description || "")
          .replace(/<[^>]+>/g, "")
          .slice(0, 220);
        return (
          <div
            key={anime.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              active ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <LazyImage
              src={img}
              alt={title}
              className="w-full h-full object-cover scale-105 blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/10" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />

            <div
              className={`absolute bottom-8 sm:bottom-14 left-4 sm:left-10 right-4 sm:right-auto max-w-xl transition-all duration-700 ${
                active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              <h2 className="directory-hero-title text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight line-clamp-2">
                {title}
              </h2>
              {desc && (
                <p className="hidden sm:block mt-3 text-sm md:text-base text-white/75 line-clamp-3 font-serif-body">
                  {desc}
                </p>
              )}
              <div className="mt-4 sm:mt-6 flex items-center gap-3">
                <Link
                  to={`/anime/${anime.id}`}
                  className="directory-glass rounded-full px-5 py-2.5 text-xs sm:text-sm font-medium text-white inline-flex items-center gap-2 hover:scale-105 hover:bg-primary/30 transition-all"
                >
                  <Info className="w-4 h-4" /> Ver detalles
                </Link>
                <Link
                  to={`/anime/${anime.id}`}
                  className="rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold bg-primary text-primary-foreground inline-flex items-center gap-2 hover:scale-105 transition-all"
                >
                  <Play className="w-4 h-4 fill-current" /> Ver ahora
                </Link>
              </div>
            </div>
          </div>
        );
      })}

      {/* Flechas desktop */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Anterior"
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full directory-glass items-center justify-center text-white hover:bg-primary/30 transition"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Siguiente"
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full directory-glass items-center justify-center text-white hover:bg-primary/30 transition"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-8 bg-primary" : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Reanudar" : "Pausar"}
            className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 w-9 h-9 rounded-full directory-glass flex items-center justify-center text-white hover:bg-primary/30 transition"
          >
            {paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
          </button>
        </>
      )}
    </section>
  );
}
