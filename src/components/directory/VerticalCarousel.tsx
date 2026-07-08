import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Info, Pause } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import LazyImage from "@/components/LazyImage";

interface Props {
  items: AniListMedia[];
}

/**
 * VerticalCarousel — carrusel editorial vertical (translateY + scale).
 * Reemplaza el hero horizontal para que el Directorio NO se sienta como el Home.
 * Solo un item enfocado a la vez, los demás entran y salen deslizando en Y.
 */
export default function VerticalCarousel({ items }: Props) {
  const slides = items.slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  if (!slides.length) {
    return (
      <div className="relative w-full h-[60vh] md:h-[80vh] bg-secondary directory-shimmer rounded-b-3xl" />
    );
  }

  return (
    <section className="relative w-full h-[70vh] md:h-[86vh] overflow-hidden">
      {/* Fondo dinámico difuminado del slide actual */}
      {slides.map((a, i) => (
        <div
          key={`bg-${a.id}`}
          className={`absolute inset-0 transition-opacity duration-1000 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <LazyImage
            src={a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || ""}
            alt=""
            className="w-full h-full object-cover scale-110 blur-2xl opacity-60"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background pointer-events-none" />

      {/* Firma */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-8 z-20 pointer-events-none">
        <p className="text-[10px] sm:text-xs font-light tracking-[0.45em] text-white/60 uppercase">
          Directorio · En cartel
        </p>
        <div className="mt-1 h-px w-10 bg-primary/60" />
      </div>

      {/* Grid con carrusel vertical */}
      <div className="relative z-10 h-full grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-6 px-5 md:px-14 items-center">
        {/* Cara narrativa */}
        <div className="relative min-h-[38vh] md:min-h-[60vh]">
          {slides.map((a, i) => {
            const title = getTitle(a);
            const desc = (a.description || "").replace(/<[^>]+>/g, "").slice(0, 240);
            const active = i === index;
            return (
              <article
                key={`t-${a.id}`}
                className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  active
                    ? "opacity-100 translate-y-0"
                    : i < index
                    ? "opacity-0 -translate-y-8 pointer-events-none"
                    : "opacity-0 translate-y-8 pointer-events-none"
                }`}
              >
                <p className="text-[10px] tracking-[0.4em] uppercase text-primary/80 mb-3">
                  Episodio {String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                </p>
                <h2 className="directory-hero-title text-3xl sm:text-5xl md:text-6xl font-bold text-white leading-tight line-clamp-3">
                  {title}
                </h2>
                {a.genres?.length ? (
                  <p className="mt-3 text-[11px] uppercase tracking-widest text-white/60">
                    {a.genres.slice(0, 3).join(" · ")}
                  </p>
                ) : null}
                {desc && (
                  <p className="hidden md:block mt-5 text-sm text-white/70 max-w-lg font-serif-body italic line-clamp-4">
                    "{desc}"
                  </p>
                )}
                <div className="mt-5 md:mt-8 flex items-center gap-3">
                  <Link
                    to={`/anime/${a.id}`}
                    className="rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold bg-primary text-primary-foreground inline-flex items-center gap-2 hover:scale-105 transition-transform"
                  >
                    <Play className="w-4 h-4 fill-current" /> Ver ahora
                  </Link>
                  <Link
                    to={`/anime/${a.id}`}
                    className="directory-glass rounded-full px-5 py-2.5 text-xs sm:text-sm font-medium text-white inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
                  >
                    <Info className="w-4 h-4" /> Detalles
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Torre vertical con posters */}
        <div className="relative hidden md:block h-[70vh]">
          {slides.map((a, i) => {
            const offset = (i - index + slides.length) % slides.length;
            // -1 arriba, 0 centro, 1 abajo, resto oculto
            let translate = "translateY(120%) scale(0.7)";
            let opacity = 0;
            let z = 0;
            if (offset === 0) {
              translate = "translateY(0) scale(1)";
              opacity = 1;
              z = 30;
            } else if (offset === 1) {
              translate = "translateY(75%) scale(0.82)";
              opacity = 0.45;
              z = 20;
            } else if (offset === slides.length - 1) {
              translate = "translateY(-75%) scale(0.82)";
              opacity = 0.45;
              z = 20;
            }
            return (
              <button
                key={`p-${a.id}`}
                onClick={() => setIndex(i)}
                aria-label={getTitle(a)}
                className="absolute left-1/2 top-1/2 -ml-[140px] -mt-[210px] w-[280px] h-[420px] rounded-2xl overflow-hidden shadow-2xl transition-all duration-[700ms] ease-[cubic-bezier(0.22,1,0.36,1)] border border-white/10"
                style={{
                  transform: translate,
                  opacity,
                  zIndex: z,
                  pointerEvents: offset > 1 && offset < slides.length - 1 ? "none" : "auto",
                }}
              >
                <LazyImage
                  src={a.coverImage?.extraLarge || a.coverImage?.large || ""}
                  alt={getTitle(a)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Controles */}
      <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Slide ${i + 1}`}
            className={`w-1 rounded-full transition-all ${
              i === index ? "h-10 bg-primary" : "h-4 bg-white/30 hover:bg-white/60"
            }`}
          />
        ))}
      </div>

      <button
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Reanudar" : "Pausar"}
        className="absolute bottom-4 right-4 z-20 w-9 h-9 rounded-full directory-glass flex items-center justify-center text-white hover:bg-primary/30 transition"
      >
        {paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
      </button>
    </section>
  );
}
