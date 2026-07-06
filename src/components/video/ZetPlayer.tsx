import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, Loader2, PictureInPicture2, ListVideo, Settings2, X, Check,
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

export interface ZetEpisodeItem {
  number: number;
  title?: string;
  thumbnail?: string;
}

interface ZetPlayerProps {
  src: string;
  title?: string;
  episode?: number;
  onNext?: () => void;
  hasNext?: boolean;
  onEnded?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  episodes?: ZetEpisodeItem[];
  onSelectEpisode?: (n: number) => void;
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export default function ZetPlayer({
  src, title, episode, onNext, hasNext, onEnded, onProgress,
  episodes = [], onSelectEpisode,
}: ZetPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  const hideTimer = useRef<any>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showNextCountdown, setShowNextCountdown] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [episodesOpen, setEpisodesOpen] = useState(false);

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

  // Apply speed on change
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // ── Controls auto-hide (3s) ────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setShowControls(false);
      setSpeedOpen(false);
    }, 3000);
  }, []);

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
        className={`w-full h-full object-contain transition-all duration-500 ${episodesOpen ? "brightness-50 scale-[0.98]" : ""}`}
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
          className="absolute bottom-20 right-4 z-20 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/15 rounded-lg text-xs font-medium text-white hover:bg-white/20 transition"
        >
          Saltar Intro ⏭
        </button>
      )}

      {/* Next ep countdown */}
      {showNextCountdown && (
        <div className="absolute bottom-20 right-4 z-20 bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-3 text-center min-w-[140px]">
          <p className="text-[10px] text-white/50 mb-1 font-mono uppercase tracking-widest">Siguiente en</p>
          <p className="text-3xl font-mono font-light text-primary tabular-nums">{countdown}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={(e) => { e.stopPropagation(); setShowNextCountdown(false); setCountdown(5); }}
              className="flex-1 text-[10px] text-white/50 py-1 rounded bg-white/5 hover:bg-white/10 transition">Cancelar</button>
            <button onClick={(e) => { e.stopPropagation(); onNext?.(); }}
              className="flex-1 text-[10px] text-white py-1 rounded bg-primary hover:shadow-[0_0_16px_hsl(var(--primary)/0.6)] transition">Ahora</button>
          </div>
        </div>
      )}

      {/* Controls layer */}
      <div
        className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-700 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top HUD */}
        <div className="bg-gradient-to-b from-black/80 to-transparent px-4 pt-3 pb-8 flex items-center gap-2">
          <p className="text-xs text-white font-light tracking-wide flex-1 truncate">{title}</p>
          {episode && <span className="text-[10px] text-white/40 font-mono tabular-nums">EP · {episode}</span>}
          {document.pictureInPictureEnabled && (
            <button onClick={togglePiP} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center transition">
              <PictureInPicture2 className="w-3.5 h-3.5 text-white/70" />
            </button>
          )}
          <button onClick={toggleFullscreen} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center transition">
            {fullscreen ? <Minimize className="w-3.5 h-3.5 text-white" /> : <Maximize className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>

        {/* Center play */}
        <div className="flex items-center justify-center">
          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-primary/20 hover:border-primary/60 hover:shadow-[0_0_32px_hsl(var(--primary)/0.55)] transition-all"
          >
            {playing
              ? <Pause className="w-7 h-7 text-white" strokeWidth={1.5} />
              : <Play className="w-7 h-7 text-white fill-white ml-0.5" strokeWidth={1.5} />}
          </button>
        </div>

        {/* Bottom HUD (slim) */}
        <div className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-6 space-y-2">
          {/* Progress bar (thin) */}
          <div
            className="group w-full h-[3px] bg-white/15 rounded-full overflow-hidden cursor-pointer hover:h-[5px] transition-all"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * 100);
            }}
          >
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%`, boxShadow: "0 0 8px hsl(var(--primary) / 0.7)" }} />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-primary transition">
              {playing
                ? <Pause className="w-5 h-5" strokeWidth={1.5} />
                : <Play className="w-5 h-5 fill-white ml-0.5" strokeWidth={1.5} />}
            </button>
            <button
              onClick={() => { const m = !muted; setMuted(m); if (videoRef.current) videoRef.current.muted = m; }}
              className="text-white/70 hover:text-white transition"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-[11px] text-white/60 flex-1 font-mono tabular-nums tracking-wider">
              {fmt(currentTime)} <span className="text-white/25 mx-1">/</span> {fmt(duration)}
            </span>

            {/* Speed popover */}
            <div className="relative">
              <button
                onClick={() => setSpeedOpen((v) => !v)}
                className="flex items-center gap-1 text-white/70 hover:text-primary transition"
                aria-label="Velocidad"
              >
                <Settings2 className="w-4 h-4" />
                <span className="text-[10px] font-mono tabular-nums">{speed}x</span>
              </button>
              {speedOpen && (
                <div className="absolute right-0 bottom-8 w-32 rounded-xl bg-black/70 backdrop-blur-xl border border-white/10 p-1.5 animate-fade-in shadow-2xl">
                  <p className="text-[9px] font-mono uppercase tracking-widest text-white/40 px-2 pt-1 pb-1.5">Velocidad</p>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setSpeed(s); setSpeedOpen(false); }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-mono tabular-nums transition ${
                        speed === s ? "bg-primary/20 text-primary" : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{s}x</span>
                      {speed === s && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {episodes.length > 0 && (
              <button
                onClick={() => setEpisodesOpen(true)}
                className="text-white/70 hover:text-primary transition"
                aria-label="Episodios"
              >
                <ListVideo className="w-4 h-4" />
              </button>
            )}

            {hasNext && (
              <button onClick={onNext} className="flex items-center gap-1 text-[11px] text-white/70 hover:text-primary transition">
                <SkipForward className="w-4 h-4" />
                <span className="font-mono uppercase tracking-widest text-[10px]">Sig</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Episodes side panel */}
      {episodes.length > 0 && (
        <>
          {/* Backdrop */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-500 ${episodesOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={(e) => { e.stopPropagation(); setEpisodesOpen(false); }}
          />
          <aside
            className={`absolute top-0 right-0 h-full w-full max-w-sm bg-black/60 backdrop-blur-xl border-l border-white/10 transition-transform duration-500 ease-out z-30 flex flex-col ${
              episodesOpen ? "translate-x-0" : "translate-x-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/40">Episodios</p>
                <h3 className="text-sm font-light text-white tracking-wide mt-0.5 truncate">{title}</h3>
              </div>
              <button
                onClick={() => setEpisodesOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {episodes.map((ep) => {
                const active = ep.number === episode;
                return (
                  <button
                    key={ep.number}
                    onClick={() => { onSelectEpisode?.(ep.number); setEpisodesOpen(false); }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                      active
                        ? "bg-primary/15 border border-primary/40"
                        : "border border-transparent hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className={`w-20 h-12 rounded-md overflow-hidden flex-shrink-0 bg-white/5 flex items-center justify-center ${active ? "ring-1 ring-primary/60" : ""}`}>
                      {ep.thumbnail ? (
                        <img src={ep.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-[10px] font-mono text-white/30">EP</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-mono tabular-nums ${active ? "text-primary" : "text-white/50"}`}>
                        {String(ep.number).padStart(2, "0")}
                      </p>
                      <p className="text-xs font-light text-white/90 truncate mt-0.5">
                        {ep.title || `Episodio ${ep.number}`}
                      </p>
                    </div>
                    {active && playing && (
                      <span className="text-[9px] font-mono uppercase tracking-widest text-primary">Now</span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
