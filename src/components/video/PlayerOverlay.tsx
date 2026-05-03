// Overlay decorativo del player. Solo navegación de episodios (prev/next) y chip.
// Los controles de skip y "atrás" están abajo del player, no encima.
// pointer-events: none en la raíz, auto solo en los controles reales.
import { useEffect, useState, useRef } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

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

  const hasPrev = episode > 1;
  const hasNext = episode < totalEpisodes;
  const posClass = isFullscreen ? "fixed inset-0 z-[2147483647]" : "absolute inset-0 z-30";

  return (
    <div
      className={`pointer-events-none ${posClass} transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Prev — solo en fullscreen para no estorbar al ver normal */}
      {isFullscreen && (
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
      )}

      {/* Next — solo en fullscreen */}
      {isFullscreen && (
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
      )}
    </div>
  );
}
