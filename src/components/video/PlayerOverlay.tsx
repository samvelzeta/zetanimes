// Overlay decorativo + navegación de episodios (sin botón central de play).
// pointer-events: none en la raíz, auto solo en los controles reales.
import { useEffect, useState, useRef } from "react";
import { ChevronsLeft, ChevronsRight, FastForward, Rewind } from "lucide-react";

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
  const [hasNativeVideo, setHasNativeVideo] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

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

  // Detectar <video> nativo para habilitar skip controls
  useEffect(() => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const v = containerRef.current?.querySelector("video");
      if (v) setHasNativeVideo(true);
      if (attempts > 25) clearInterval(interval);
    }, 400);
    return () => clearInterval(interval);
  }, [containerRef, episode]);

  // Auto-hide en fullscreen
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

  const skip = (seconds: number) => {
    const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!v) return;
    try {
      v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + seconds));
    } catch {}
  };

  const hasPrev = episode > 1;
  const hasNext = episode < totalEpisodes;
  const posClass = isFullscreen ? "fixed inset-0 z-[2147483647]" : "absolute inset-0 z-30";

  return (
    <div
      className={`pointer-events-none ${posClass} transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Chip episodio */}
      <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 text-white text-xs font-bold tracking-wide shadow-lg border border-primary/20">
        EP {episode} {totalEpisodes > 0 && <span className="opacity-60">/ {totalEpisodes}</span>}
      </div>

      {/* Prev */}
      <div className="pointer-events-auto absolute left-2 sm:left-4 top-1/2 -translate-y-1/2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-md border-2 border-primary/60 bg-black/30 hover:bg-primary/30 hover:border-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
          aria-label="Episodio anterior"
        >
          <ChevronsLeft className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Next */}
      <div className="pointer-events-auto absolute right-2 sm:right-4 top-1/2 -translate-y-1/2">
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-md border-2 border-primary/60 bg-black/30 hover:bg-primary/30 hover:border-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
          aria-label="Episodio siguiente"
        >
          <ChevronsRight className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Skip controls — solo si tenemos video nativo y estamos en fullscreen */}
      {isFullscreen && hasNativeVideo && (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 flex-wrap justify-center">
          <button
            onClick={() => skip(-10)}
            className="px-3 py-2 rounded-lg bg-black/80 hover:bg-primary text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg border border-primary/20"
          >
            <Rewind className="w-3.5 h-3.5" /> -10s
          </button>
          <button
            onClick={() => skip(90)}
            className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            <FastForward className="w-3.5 h-3.5" /> Saltar Intro (+90s)
          </button>
          <button
            onClick={() => skip(90)}
            className="px-3 py-2 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition shadow-lg"
          >
            <FastForward className="w-3.5 h-3.5" /> Saltar Ending (+90s)
          </button>
          <button
            onClick={() => skip(10)}
            className="px-3 py-2 rounded-lg bg-black/80 hover:bg-primary text-white text-xs font-bold flex items-center gap-1.5 transition shadow-lg border border-primary/20"
          >
            +10s <FastForward className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
