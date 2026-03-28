import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, Loader2, PictureInPicture2
} from "lucide-react";

// ── HLS.js dynamic loader ────────────────────────────────────────
let HlsLib: any = null;
async function loadHls() {
  if (HlsLib) return HlsLib;
  if ((window as any).Hls) { HlsLib = (window as any).Hls; return HlsLib; }
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js";
    script.onload = () => { HlsLib = (window as any).Hls; resolve(HlsLib); };
    document.head.appendChild(script);
  });
}

interface ZetPlayerProps {
  src: string;
  title?: string;
  episode?: number;
  onNext?: () => void;
  hasNext?: boolean;
  onEnded?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
}

export default function ZetPlayer({
  src, title, episode, onNext, hasNext, onEnded, onProgress,
}: ZetPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const hideTimer = useRef<any>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // ── HLS / native video init ────────────────────────────────────
  useEffect(() => {
    if (!src || !videoRef.current) return;
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const video = videoRef.current;
    const isHLS = src.includes(".m3u8");

    const init = async () => {
      setBuffering(true);
      if (isHLS) {
        const Hls = await loadHls();
        if (Hls?.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
          hls.on(Hls.Events.ERROR, (_: any, d: any) => { if (d.fatal) hls.destroy(); });
          hlsRef.current = hls;
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          video.play().catch(() => {});
        }
      } else {
        video.src = src;
        video.load();
        video.play().catch(() => {});
      }
    };

    init();
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [src]);

  // ── Controls auto-hide ─────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // ── Time update → progress callback ───────────────────────────
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    const d = v.duration || 0;
    setCurrentTime(t);
    setDuration(d);
    setProgress(d ? (t / d) * 100 : 0);
    onProgress?.(t, d);
    setShowSkipIntro(t > 60 && t < 150);
    if (d > 0 && t / d >= 0.9 && hasNext && !showNextCountdown) {
      setShowNextCountdown(true);
    }
  };

  // ── Next episode countdown ────────────────────────────────────
  useEffect(() => {
    if (!showNextCountdown) return;
    if (countdown <= 0) { setShowNextCountdown(false); setCountdown(5); onNext?.(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showNextCountdown, countdown, onNext]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
    resetHideTimer();
  };

  const seek = (pct: number) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = (pct / 100) * v.duration;
    resetHideTimer();
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => {});
    else await v.requestPictureInPicture().catch(() => {});
  };

  const fmt = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black overflow-hidden rounded-xl"
      onMouseMove={resetHideTimer}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onPlaying={() => { setPlaying(true); setBuffering(false); }}
        onPause={() => setPlaying(false)}
        onWaiting={() => setBuffering(true)}
        onEnded={() => { setPlaying(false); onEnded?.(); }}
        muted={muted}
        playsInline
        crossOrigin="anonymous"
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {/* Skip intro */}
      {showSkipIntro && (
        <button
          onClick={(e) => { e.stopPropagation(); if (videoRef.current) videoRef.current.currentTime = 150; setShowSkipIntro(false); }}
          className="absolute bottom-20 right-4 z-20 px-4 py-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg text-xs font-medium text-white hover:bg-white/25 transition"
        >
          Saltar Intro ⏭
        </button>
      )}

      {/* Next ep countdown */}
      {showNextCountdown && (
        <div className="absolute bottom-20 right-4 z-20 bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center min-w-[140px]">
          <p className="text-[10px] text-white/50 mb-1">Siguiente episodio en</p>
          <p className="text-2xl font-black text-primary">{countdown}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={(e) => { e.stopPropagation(); setShowNextCountdown(false); setCountdown(5); }}
              className="flex-1 text-[10px] text-white/40 py-1 rounded bg-white/5">Cancelar</button>
            <button onClick={(e) => { e.stopPropagation(); onNext?.(); }}
              className="flex-1 text-[10px] text-white py-1 rounded bg-primary">Ahora</button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top */}
        <div className="bg-gradient-to-b from-black/70 to-transparent p-3 flex items-center gap-2">
          <p className="text-xs text-white font-medium flex-1 truncate">{title}</p>
          {episode && <span className="text-[10px] text-white/40">Ep. {episode}</span>}
          {document.pictureInPictureEnabled && (
            <button onClick={togglePiP} className="w-7 h-7 rounded bg-white/10 flex items-center justify-center">
              <PictureInPicture2 className="w-3.5 h-3.5 text-white/60" />
            </button>
          )}
          <button onClick={toggleFullscreen} className="w-7 h-7 rounded bg-white/10 flex items-center justify-center">
            {fullscreen ? <Minimize className="w-3.5 h-3.5 text-white" /> : <Maximize className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>

        {/* Center play */}
        <div className="flex items-center justify-center">
          <button onClick={togglePlay} className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition">
            {playing ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white fill-white ml-0.5" />}
          </button>
        </div>

        {/* Bottom */}
        <div className="bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 space-y-2">
          <div
            className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * 100);
            }}
          >
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={togglePlay}>
              {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white fill-white ml-0.5" />}
            </button>
            <button onClick={() => { const m = !muted; setMuted(m); if (videoRef.current) videoRef.current.muted = m; }}>
              {muted ? <VolumeX className="w-4 h-4 text-white/60" /> : <Volume2 className="w-4 h-4 text-white/60" />}
            </button>
            <span className="text-[10px] text-white/50 flex-1">{fmt(currentTime)} / {fmt(duration)}</span>
            {hasNext && (
              <button onClick={onNext} className="flex items-center gap-1 text-[10px] text-white/60 hover:text-white">
                <SkipForward className="w-4 h-4" /> Sig.
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
