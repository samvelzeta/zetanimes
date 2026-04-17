// Overlay de "maquillaje" que va ENCIMA del player.
// Visible siempre en modo normal Y en fullscreen.
// Provee: prev/next, play/pause central con rayo, skip intro/ending + ±10s.
// NO controla la barra de progreso del player nativo.
import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, FastForward, Rewind } from "lucide-react";

interface Props {
  episode: number;
  totalEpisodes: number;
  onPrev: () => void;
  onNext: () => void;
  containerRef: React.RefObject<HTMLElement>;
}

// Rayo SVG reutilizado del SplashScreen — vertical (orientation = "vertical")
// o tumbado horizontal (rotado 90°). Aplica drop-shadow naranja.
function BoltIcon({ horizontal, size = 28 }: { horizontal: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        transform: horizontal ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 200ms ease",
        filter: "drop-shadow(0 0 6px hsl(16 100% 55%)) drop-shadow(0 0 12px hsl(16 100% 50% / 0.6))",
      }}
    >
      <defs>
        <linearGradient id="boltGradOverlay" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(45 100% 70%)" />
          <stop offset="50%" stopColor="hsl(20 100% 55%)" />
          <stop offset="100%" stopColor="hsl(10 100% 45%)" />
        </linearGradient>
      </defs>
      <path
        d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"
        fill="url(#boltGradOverlay)"
        stroke="hsl(40 100% 75%)"
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PlayerOverlay({ episode, totalEpisodes, onPrev, onNext, containerRef }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [show, setShow] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Detectar fullscreen sobre nuestro contenedor
  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement;
      setIsFullscreen(
        !!el &&
          (el === containerRef.current ||
            containerRef.current?.contains(el as Node) ||
            (el as Node)?.contains(containerRef.current!))
      );
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
    };
  }, [containerRef]);

  // Tracker del estado play/pause del video subyacente
  useEffect(() => {
    const findVideo = () => containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    let v = findVideo();

    const sync = () => {
      const cur = findVideo();
      if (!cur) return;
      setIsPlaying(!cur.paused);
    };

    // Reintenta encontrar el video cada 500ms hasta los 5s (los iframes tardan)
    let attempts = 0;
    const findInterval = setInterval(() => {
      attempts++;
      v = findVideo();
      if (v || attempts > 10) clearInterval(findInterval);
      if (v) {
        sync();
        v.addEventListener("play", sync);
        v.addEventListener("pause", sync);
      }
    }, 500);

    return () => {
      clearInterval(findInterval);
      const cur = findVideo();
      cur?.removeEventListener("play", sync);
      cur?.removeEventListener("pause", sync);
    };
  }, [containerRef, episode]);

  // Auto-hide en fullscreen tras 3.5s; en modo normal siempre visible
  useEffect(() => {
    if (!isFullscreen) {
      setShow(true);
      return;
    }
    const reveal = () => {
      setShow(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShow(false), 3500);
    };
    reveal();
    const target = containerRef.current;
    target?.addEventListener("mousemove", reveal);
    target?.addEventListener("touchstart", reveal);
    return () => {
      target?.removeEventListener("mousemove", reveal);
      target?.removeEventListener("touchstart", reveal);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isFullscreen, containerRef]);

  const togglePlayPause = () => {
    const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!v) return;
    try {
      if (v.paused) v.play();
      else v.pause();
    } catch {}
  };

  const skip = (seconds: number) => {
    const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!v) return;
    try {
      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + seconds));
    } catch {}
  };

  const hasPrev = episode > 1;
  const hasNext = episode < totalEpisodes;

  // En fullscreen: posición fixed para flotar sobre el video real (z-index máximo)
  // En modo normal: absolute encima del player container
  const posClass = isFullscreen ? "fixed inset-0 z-[2147483647]" : "absolute inset-0 z-30";

  return (
    <div
      className={`pointer-events-none ${posClass} transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
    >
      {/* Chip episodio arriba */}
      <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-white text-xs font-bold tracking-wide shadow-lg">
        EP {episode} {totalEpisodes > 0 && <span className="opacity-60">/ {totalEpisodes}</span>}
      </div>

      {/* Botón play/pause CENTRAL con rayo */}
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center">
        <button
          onClick={togglePlayPause}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/50 hover:bg-primary/30 backdrop-blur flex items-center justify-center transition-all shadow-2xl active:scale-95"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          title={isPlaying ? "Pausar" : "Reproducir"}
        >
          {/* Rayo: horizontal = pausa visual, vertical = reproduciendo */}
          <BoltIcon horizontal={isPlaying} size={isFullscreen ? 36 : 30} />
        </button>
      </div>

      {/* Botones laterales prev/next — siempre visibles (modo normal Y fullscreen) */}
      <div className="pointer-events-auto absolute left-2 sm:left-4 top-1/2 -translate-y-1/2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 backdrop-blur hover:bg-primary disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition shadow-xl"
          aria-label="Episodio anterior"
          title="Episodio anterior"
        >
          <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>
      <div className="pointer-events-auto absolute right-2 sm:right-4 top-1/2 -translate-y-1/2">
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/70 backdrop-blur hover:bg-primary disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition shadow-xl"
          aria-label="Episodio siguiente"
          title="Episodio siguiente"
        >
          <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>

      {/* Skip controls abajo — solo en fullscreen */}
      {isFullscreen && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={() => skip(-10)}
            className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur hover:bg-primary text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            <Rewind className="w-3.5 h-3.5" /> -10s
          </button>
          <button
            onClick={() => skip(90)}
            className="px-3 py-2 rounded-lg bg-primary backdrop-blur hover:bg-primary/80 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            <FastForward className="w-3.5 h-3.5" /> Saltar Intro (+90s)
          </button>
          <button
            onClick={() => skip(90)}
            className="px-3 py-2 rounded-lg bg-primary backdrop-blur hover:bg-primary/80 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            <FastForward className="w-3.5 h-3.5" /> Saltar Ending (+90s)
          </button>
          <button
            onClick={() => skip(10)}
            className="px-3 py-2 rounded-lg bg-black/70 backdrop-blur hover:bg-primary text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            +10s <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
