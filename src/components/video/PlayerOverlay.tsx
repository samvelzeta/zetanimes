// Overlay "maquillaje" sobre el iframe/player externo.
// Técnica:
//   - Capa raíz con pointer-events: none (los clics atraviesan al iframe)
//   - Cada control individual reactiva pointer-events: auto
//   - Para el play/pause central intentamos controlar el <video> nativo si existe.
//     Si no (iframe cross-origin), el botón hace toggle visual y deja pasar el clic
//     al iframe usando un pequeño truco: ocultamos brevemente el overlay.
import { useEffect, useState, useRef, forwardRef } from "react";
import { ChevronsLeft, ChevronsRight, FastForward, Rewind } from "lucide-react";

interface Props {
  episode: number;
  totalEpisodes: number;
  onPrev: () => void;
  onNext: () => void;
  containerRef: React.RefObject<HTMLElement>;
}

/** TUERCA hexagonal oscura con rayo central. horizontal=true → rayo tumbado (pausado). */
const NutBolt = forwardRef<SVGSVGElement, { horizontal: boolean; size?: number }>(
  ({ horizontal, size = 72 }, ref) => (
    <svg ref={ref} width={size} height={size} viewBox="0 0 100 100" style={{ display: "block" }}>
      <defs>
        <radialGradient id="nutBg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="hsl(20 25% 18%)" />
          <stop offset="60%" stopColor="hsl(18 30% 10%)" />
          <stop offset="100%" stopColor="hsl(15 40% 5%)" />
        </radialGradient>
        <linearGradient id="nutBevel" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(25 50% 35%)" />
          <stop offset="100%" stopColor="hsl(15 30% 8%)" />
        </linearGradient>
        <linearGradient id="nutBolt" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(45 100% 70%)" />
          <stop offset="50%" stopColor="hsl(20 100% 55%)" />
          <stop offset="100%" stopColor="hsl(10 100% 45%)" />
        </linearGradient>
      </defs>
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill="url(#nutBg)"
        stroke="url(#nutBevel)"
        strokeWidth="2.5"
      />
      <polygon
        points="50,12 84,30 84,70 50,88 16,70 16,30"
        fill="none"
        stroke="hsl(22 40% 22%)"
        strokeWidth="0.8"
      />
      <circle cx="50" cy="50" r="28" fill="hsl(15 35% 6%)" stroke="hsl(22 45% 25%)" strokeWidth="1.2" />
      <g
        transform={`rotate(${horizontal ? 90 : 0} 50 50)`}
        style={{
          transformOrigin: "50px 50px",
          transition: "transform 250ms cubic-bezier(0.4,0,0.2,1)",
          filter: "drop-shadow(0 0 4px hsl(16 100% 55%)) drop-shadow(0 0 8px hsl(16 100% 50% / 0.6))",
        }}
      >
        <path
          d="M54 28 L38 54 H50 L46 72 L62 46 H50 L54 28 Z"
          fill="url(#nutBolt)"
          stroke="hsl(40 100% 75%)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
);
NutBolt.displayName = "NutBolt";

export default function PlayerOverlay({ episode, totalEpisodes, onPrev, onNext, containerRef }: Props) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [show, setShow] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasNativeVideo, setHasNativeVideo] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  // Detectar fullscreen
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

  // Polling para encontrar el <video> nativo (HLS/MP4 directo dentro de mismo origen)
  useEffect(() => {
    let attempts = 0;
    let attached: HTMLVideoElement | null = null;
    const findVideo = () => containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    const sync = () => {
      const v = findVideo();
      if (v) setIsPlaying(!v.paused);
    };
    const interval = setInterval(() => {
      attempts++;
      const v = findVideo();
      if (v && v !== attached) {
        attached = v;
        setHasNativeVideo(true);
        sync();
        v.addEventListener("play", sync);
        v.addEventListener("pause", sync);
      }
      if (attempts > 25) clearInterval(interval);
    }, 400);
    return () => {
      clearInterval(interval);
      if (attached) {
        attached.removeEventListener("play", sync);
        attached.removeEventListener("pause", sync);
      }
    };
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

  const togglePlayPause = () => {
    const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (v) {
      try {
        if (v.paused) v.play();
        else v.pause();
        return;
      } catch {}
    }
    // Fallback iframe: postMessage (algunos players lo soportan)
    const iframe = containerRef.current?.querySelector("iframe") as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.postMessage({ action: isPlaying ? "pause" : "play" }, "*");
        iframe.contentWindow.postMessage(isPlaying ? "pause" : "play", "*");
        setIsPlaying(!isPlaying);
      } catch {}
    }
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
  const posClass = isFullscreen ? "fixed inset-0 z-[2147483647]" : "absolute inset-0 z-30";

  return (
    <div
      className={`pointer-events-none ${posClass} transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
    >
      {/* Chip episodio */}
      <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/80 text-white text-xs font-bold tracking-wide shadow-lg border border-primary/20">
        EP {episode} {totalEpisodes > 0 && <span className="opacity-60">/ {totalEpisodes}</span>}
      </div>

      {/* TUERCA play/pause central */}
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center">
        <button
          onClick={togglePlayPause}
          className="active:scale-95 hover:scale-110 transition-transform"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          title={hasNativeVideo ? (isPlaying ? "Pausar" : "Reproducir") : "Reproducir (control limitado en este servidor)"}
          style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.7))" }}
        >
          <NutBolt horizontal={!isPlaying} size={isFullscreen ? 96 : 72} />
        </button>
      </div>

      {/* Prev — flecha simple con borde naranja (estilo imagen referencia) */}
      <div className="pointer-events-auto absolute left-2 sm:left-4 top-1/2 -translate-y-1/2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-md border-2 border-primary/60 bg-black/30 hover:bg-primary/30 hover:border-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
          aria-label="Episodio anterior"
          title="Episodio anterior"
        >
          <ChevronsLeft className="w-6 h-6 sm:w-7 sm:h-7 text-white" strokeWidth={2.5} />
        </button>
      </div>

      {/* Next — flecha simple con borde naranja */}
      <div className="pointer-events-auto absolute right-2 sm:right-4 top-1/2 -translate-y-1/2">
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="w-11 h-11 sm:w-14 sm:h-14 rounded-md border-2 border-primary/60 bg-black/30 hover:bg-primary/30 hover:border-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
          aria-label="Episodio siguiente"
          title="Episodio siguiente"
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
