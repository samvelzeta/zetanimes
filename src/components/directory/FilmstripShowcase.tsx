import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Info, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import LazyImage from "@/components/LazyImage";
import { useTranslatedDesc } from "@/hooks/useTranslatedDesc";

interface Props {
  items: AniListMedia[];
}

/**
 * FilmstripShowcase — carrusel editorial horizontal 3D estilo "coverflow".
 * Diferente al VerticalCarousel (que ahora vive en Home): aquí los posters
 * flotan en una tira 3D con perspectiva, y las tarjetas laterales inclinan.
 * Fondo con texto marquee tipo revista.
 */
export default function FilmstripShowcase({ items }: Props) {
  const slides = items.slice(0, 7);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (paused || slides.length < 2) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(timer.current);
  }, [paused, slides.length]);

  if (!slides.length) {
    return <div className="w-full h-[62vh] md:h-[78vh] bg-secondary directory-shimmer" />;
  }

  const go = (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length);
  const current = slides[index];
  const desc = (current.description || "").replace(/<[^>]+>/g, "").slice(0, 220);

  return (
    <section className="relative w-full h-[70vh] md:h-[86vh] overflow-hidden bg-background">
      {/* Fondo blur + gradiente cinematográfico */}
      {slides.map((a, i) => (
        <div
          key={`bg-${a.id}`}
          className={`absolute inset-0 transition-opacity duration-[1200ms] ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          <LazyImage
            src={a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || ""}
            alt=""
            className="w-full h-full object-cover scale-125 blur-3xl opacity-40"
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background pointer-events-none" />

      {/* Marquee editorial de fondo */}
      <div className="absolute inset-x-0 top-8 md:top-16 z-[1] overflow-hidden pointer-events-none select-none">
        <div className="filmstrip-marquee whitespace-nowrap directory-hero-title text-[15vw] md:text-[11vw] font-black text-white/[0.04] tracking-tight">
          {slides.map((a) => getTitle(a)).join(" · ")} · {slides.map((a) => getTitle(a)).join(" · ")}
        </div>
      </div>

      {/* Firma superior — desplazada bajo el header fijo */}
      <div className="absolute top-14 md:top-20 left-4 md:left-8 z-20 pointer-events-none">
        <p className="text-[10px] md:text-xs font-light tracking-[0.45em] text-white/70 uppercase">
          Filmstrip · En cartel
        </p>
        <div className="mt-1 h-px w-10 bg-primary/60" />
      </div>


      {/* Tira 3D horizontal */}
      <div
        className="filmstrip-stage absolute inset-x-0 top-1/2 -translate-y-[58%] md:-translate-y-[62%] z-10 h-[48vh] md:h-[56vh]"
        style={{ perspective: "1400px" }}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {slides.map((a, i) => {
            const raw = ((i - index) + slides.length) % slides.length;
            const offset = raw > slides.length / 2 ? raw - slides.length : raw;
            const abs = Math.abs(offset);
            if (abs > 3) return null;
            const translate = offset * 220;
            const rotate = offset === 0 ? 0 : offset > 0 ? -22 : 22;
            const scale = offset === 0 ? 1 : 0.78 - abs * 0.06;
            const opacity = abs > 2 ? 0 : 1 - abs * 0.25;
            const z = 50 - abs * 10;
            return (
              <button
                key={a.id}
                onClick={() => setIndex(i)}
                aria-label={getTitle(a)}
                className="absolute rounded-2xl overflow-hidden shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)] transition-all duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] border border-white/10"
                style={{
                  width: "clamp(180px, 26vw, 320px)",
                  aspectRatio: "2/3",
                  transform: `translateX(${translate}px) rotateY(${rotate}deg) scale(${scale})`,
                  opacity,
                  zIndex: z,
                  pointerEvents: abs > 1 ? "auto" : "auto",
                }}
              >
                <LazyImage
                  src={a.coverImage?.extraLarge || a.coverImage?.large || ""}
                  alt={getTitle(a)}
                  className="w-full h-full object-cover"
                />
                {offset !== 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60" />
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/85 to-transparent" />
                {offset === 0 && (
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[9px] tracking-[0.4em] uppercase text-primary/90">
                      Nº {String(index + 1).padStart(2, "0")}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel narrativo inferior */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-5 md:px-14 pb-10 md:pb-14 pt-6 bg-gradient-to-t from-background via-background/85 to-transparent">
        <div className="max-w-3xl">
          <p className="text-[10px] tracking-[0.5em] uppercase text-primary/80 mb-2">
            En cartel · {current.seasonYear || "—"}
          </p>
          <h2 className="directory-hero-title text-2xl sm:text-4xl md:text-5xl font-bold text-white leading-tight line-clamp-2">
            {getTitle(current)}
          </h2>
          {current.genres?.length ? (
            <p className="mt-2 text-[11px] uppercase tracking-widest text-white/60">
              {current.genres.slice(0, 3).join(" · ")}
              {current.averageScore ? (
                <span className="text-primary ml-3 font-mono">
                  ★ {(current.averageScore / 10).toFixed(1)}
                </span>
              ) : null}
            </p>
          ) : null}
          {desc && (
            <p className="hidden md:block mt-3 text-sm text-white/70 max-w-xl font-serif-body italic line-clamp-2">
              "{desc}"
            </p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Link
              to={`/anime/${current.id}`}
              className="rounded-full px-5 py-2.5 text-xs sm:text-sm font-bold bg-primary text-primary-foreground inline-flex items-center gap-2 hover:scale-105 transition-transform"
            >
              <Play className="w-4 h-4 fill-current" /> Ver ahora
            </Link>
            <Link
              to={`/anime/${current.id}`}
              className="directory-glass rounded-full px-5 py-2.5 text-xs sm:text-sm font-medium text-white inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <Info className="w-4 h-4" /> Detalles
            </Link>
          </div>
        </div>
      </div>

      {/* Flechas */}
      <button
        onClick={() => go(-1)}
        aria-label="Anterior"
        className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full directory-glass flex items-center justify-center text-white hover:bg-primary/30"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => go(1)}
        aria-label="Siguiente"
        className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-30 w-10 h-10 rounded-full directory-glass flex items-center justify-center text-white hover:bg-primary/30"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
      <button
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? "Reanudar" : "Pausar"}
        className="absolute bottom-4 right-4 z-30 w-9 h-9 rounded-full directory-glass flex items-center justify-center text-white hover:bg-primary/30 transition"
      >
        {paused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
      </button>
    </section>
  );
}
