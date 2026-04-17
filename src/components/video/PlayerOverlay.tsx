// Lightweight overlay sitting ABOVE the native player in fullscreen.
// Provides: previous/next episode, skip intro (+90s), skip ending (+90s).
// It does NOT control playback (play/pause/seek bar) — those stay on the underlying player.
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
      // Only show overlay when OUR container is the fullscreen target
      setIsFullscreen(!!el && (el === containerRef.current || containerRef.current?.contains(el as Node) || (el as Node)?.contains(containerRef.current!)));
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [containerRef]);

  // Auto-hide overlay after 3s of inactivity in fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const reveal = () => {
      setShow(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShow(false), 3000);
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

  if (!isFullscreen) return null;

  const skip = (seconds: number) => {
    const v = containerRef.current?.querySelector("video") as HTMLVideoElement | null;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((v.duration || Infinity), v.currentTime + seconds));
  };

  const hasPrev = episode > 1;
  const hasNext = episode < totalEpisodes;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[2147483647] transition-opacity duration-300 ${show ? "opacity-100" : "opacity-0"}`}
      // Render on top of fullscreen video. We intercept clicks only on the buttons.
    >
      {/* Top-right episode chip */}
      <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur text-white text-xs font-bold tracking-wide">
        EP {episode} {totalEpisodes > 0 && <span className="opacity-60">/ {totalEpisodes}</span>}
      </div>

      {/* Side controls — left / right */}
      <div className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition shadow-lg"
          aria-label="Episodio anterior"
          title="Episodio anterior"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      </div>
      <div className="pointer-events-auto absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="w-12 h-12 rounded-full bg-black/60 backdrop-blur hover:bg-primary/80 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition shadow-lg"
          aria-label="Episodio siguiente"
          title="Episodio siguiente"
        >
          <ChevronRight className="w-7 h-7" />
        </button>
      </div>

      {/* Bottom skip buttons */}
      <div className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <button
          onClick={() => skip(-10)}
          className="px-3 py-2 rounded-lg bg-black/60 backdrop-blur hover:bg-primary/80 text-white text-xs font-bold flex items-center gap-1.5 transition"
        >
          <Rewind className="w-3.5 h-3.5" /> -10s
        </button>
        <button
          onClick={() => skip(85)}
          className="px-3 py-2 rounded-lg bg-primary/80 backdrop-blur hover:bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition"
        >
          <FastForward className="w-3.5 h-3.5" /> Saltar Intro
        </button>
        <button
          onClick={() => skip(85)}
          className="px-3 py-2 rounded-lg bg-primary/80 backdrop-blur hover:bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 transition"
        >
          <FastForward className="w-3.5 h-3.5" /> Saltar Ending
        </button>
        <button
          onClick={() => skip(10)}
          className="px-3 py-2 rounded-lg bg-black/60 backdrop-blur hover:bg-primary/80 text-white text-xs font-bold flex items-center gap-1.5 transition"
        >
          +10s <FastForward className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
