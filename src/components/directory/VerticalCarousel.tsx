import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Info, Pause } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import LazyImage from "@/components/LazyImage";
import { useTranslatedDesc } from "@/hooks/useTranslatedDesc";
import { useIsDubbed } from "@/hooks/useDubbedAnimes";

function VerticalSlideText({ a, i, index, total }: { a: AniListMedia; i: number; index: number; total: number }) {
  const desc = useTranslatedDesc(a.description, a.id, 240);
  const dubbed = useIsDubbed(a);
  // Capítulos que lleva emitidos ahora mismo: si está en emisión, el próximo - 1;
  // si ya terminó, el total; fallback al índice del carrusel.
  const airedNow =
    (a.nextAiringEpisode?.episode ? a.nextAiringEpisode.episode - 1 : null) ??
    a.episodes ??
    null;
  const totalEps = a.episodes ?? airedNow ?? total;
  const currentEp = airedNow ?? i + 1;
  const active = i === index;
  const title = getTitle(a);
  // Tamaño dinámico según longitud del título (romaji suele ser largo)
  // Escala en 5 pasos para que SIEMPRE quepa sin truncado
  const titleSize =
    title.length > 60
      ? "text-base sm:text-lg md:text-xl lg:text-2xl"
      : title.length > 45
      ? "text-lg sm:text-xl md:text-2xl lg:text-3xl"
      : title.length > 34
      ? "text-xl sm:text-2xl md:text-3xl lg:text-4xl"
      : title.length > 22
      ? "text-2xl sm:text-3xl md:text-4xl lg:text-5xl"
      : "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
  return (
    <article
      className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        active
          ? "opacity-100 translate-y-0"
          : i < index
          ? "opacity-0 -translate-y-8 pointer-events-none"
          : "opacity-0 translate-y-8 pointer-events-none"
      }`}
    >
      <p className="text-[10px] tracking-[0.4em] uppercase text-primary/80 mb-3">
        Episodio {String(currentEp).padStart(2, "0")} / {String(totalEps).padStart(2, "0")}
      </p>
      <h2
        className={`directory-hero-title ${titleSize} font-bold text-white leading-[1.1] line-clamp-3 break-words`}
        style={{ wordBreak: "break-word", hyphens: "auto" }}
      >
        {title}
      </h2>
      {dubbed && (
        <p className="mt-2 text-[10px] sm:text-xs font-semibold tracking-[0.35em] uppercase text-primary/90">
          Doblado
        </p>
      )}
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
}

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
    <section className="relative w-full h-[75vh] min-h-[560px] max-h-[820px] md:h-[80vh] md:max-h-[780px] overflow-hidden">
      {/* Fondo dinámico — nítido con parallax en móvil, difuminado en desktop */}
      {slides.map((a, i) => {
        const isActive = i === index;
        return (
          <div
            key={`bg-${a.id}`}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Móvil: imagen nítida Ken Burns (solo activa) */}
            {isActive && (
              <LazyImage
                src={a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || ""}
                alt=""
                className="md:hidden w-full h-full object-cover animate-[kenburns_9s_ease-out_forwards]"
              />
            )}
            {/* Desktop: blur cinematográfico (solo activa, evita compositar 6 capas blureadas) */}
            {isActive && (
              <LazyImage
                src={a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large || ""}
                alt=""
                className="hidden md:block w-full h-full object-cover scale-110 blur-2xl opacity-60"
              />
            )}
          </div>
        );
      })}

      {/* Overlays diferenciados */}
      <div className="md:hidden absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10 pointer-events-none" />
      <div className="md:hidden absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/40 pointer-events-none" />
      <div className="hidden md:block absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background pointer-events-none" />

      {/* Firma — sutilmente elevada, con leading más compacto para respirar del título */}
      <div className="absolute top-16 left-4 sm:top-20 sm:left-8 md:top-24 z-20 pointer-events-none">
        <p className="text-[10px] sm:text-xs font-light tracking-[0.45em] text-white/70 uppercase leading-[1.4]">
          En cartel · Estreno
        </p>
        <p className="mt-0.5 text-[10px] sm:text-xs font-light tracking-[0.45em] uppercase leading-[1.4] text-primary/90">
          Esto te ofrece Zani
        </p>
        <div className="mt-1.5 h-px w-10 bg-primary/60" />
      </div>



      {/* Grid con carrusel vertical — padding balanceado (respira desde el nav sin empujar al piso) */}
      <div className="relative z-10 h-full grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-6 px-5 md:px-14 pt-24 sm:pt-28 md:pt-24 pb-56 sm:pb-52 md:pb-10 items-start md:items-center">
        {/* Cara narrativa */}
        <div className="relative min-h-[34vh] md:min-h-[52vh]">
          {slides.map((a, i) => (
            <VerticalSlideText key={`t-${a.id}`} a={a} i={i} index={index} total={slides.length} />
          ))}
        </div>


        {/* Torre vertical con posters */}
        <div className="relative hidden md:block h-[62vh] -mt-8">
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

      {/* Filmstrip móvil — posters miniatura cinematográficos */}
      <div className="md:hidden absolute bottom-16 left-0 right-0 z-20 px-5">
        <div className="flex gap-2 overflow-hidden">
          {slides.map((a, i) => {
            const offset = (i - index + slides.length) % slides.length;
            if (offset > 3) return null;
            const isCurrent = offset === 0;
            return (
              <button
                key={`mp-${a.id}`}
                onClick={() => setIndex(i)}
                aria-label={getTitle(a)}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden border transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isCurrent
                    ? "w-20 h-28 border-primary shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.7)]"
                    : "w-14 h-20 border-white/10 opacity-60"
                }`}
              >
                <LazyImage
                  src={a.coverImage?.large || a.coverImage?.extraLarge || ""}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {isCurrent && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
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
