// Overlay de "maquillaje" que va ENCIMA del player.
// Visible siempre (no solo fullscreen). Provee prev/next + skip intro/ending + ±10s.
// NO controla play/pause/seek bar — eso queda en el player nativo del proveedor.
import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, FastForward, Rewind } from "lucide-react";

interface Props {
  episode: number;
  totalEpisodes: number;
  onPrev: () => void;
  onNext: () => void;
  containerRef: React.RefObject<HTMLElement>;
}

export default function PlayerOverlay({ episode, totalEpisodes, onPrev, onNext, containerRef }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [show, setShow] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement;
      setIsFullscreen(!!el && (el === containerRef.current || containerRef.current?.contains(el as Node) || (el as Node)?.contains(containerRef.current!)));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [containerRef]);

  // Auto-hide solo en fullscreen; en modo normal siempre visible
  useEffect(() => {
    if (!isFullscreen) { setShow(true); return; }
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

  // Intenta seekear el video del provider (puede fallar si es cross-origin iframe → no-op)
  const skip = (seconds: number) => {
    const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!v) return;
    try {
      v.currentTime = Math.max(0, Math.min((v.duration || Infinity), v.currentTime + seconds));
    } catch {}
  };

  const hasPrev = episode > 1;
  const hasNext = episode < totalEpisodes;

  // Si está en fullscreen: posición fixed para flotar sobre el video.
  // En modo normal: absolute encima del player container.
  const posClass = isFullscreen
    ? "fixed inset-0 z-[2147483647]"
    : "absolute inset-0 z-30";

  return (
    <div
      className={`pointer-events-none ${posClass} transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
    >
      {/* Chip episodio arriba */}
      <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-white text-xs font-bold tracking-wide shadow-lg">
        EP {episode} {totalEpisodes > 0 && <span className="opacity-60">/ {totalEpisodes}</span>}
      </div>

      {/* Botones laterales prev/next — siempre visibles */}
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

      {/* Skip controls abajo — solo se ven en fullscreen para no estorbar el player */}
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
