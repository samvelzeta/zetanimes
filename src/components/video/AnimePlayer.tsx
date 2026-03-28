import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Play, Pause, Maximize, Volume2, VolumeX, SkipForward, Settings, Server, Loader2 } from "lucide-react";

export interface PlayerSource {
  name: string;
  embed?: string;
  url?: string;
}

interface Props {
  sources: PlayerSource[];
  title?: string;
  onProgress?: (progress: number) => void;
  autoplay?: boolean;
}

type SourceType = "hls" | "mp4" | "embed";

interface ClassifiedSource {
  type: SourceType;
  url: string;
  name: string;
}

function classifySources(sources: PlayerSource[]): ClassifiedSource[] {
  const classified: ClassifiedSource[] = [];
  for (const s of sources) {
    const url = s.embed || s.url || "";
    if (!url) continue;
    if (url.includes(".m3u8")) {
      classified.push({ type: "hls", url, name: s.name });
    } else if (url.includes(".mp4")) {
      classified.push({ type: "mp4", url, name: s.name });
    } else {
      classified.push({ type: "embed", url, name: s.name });
    }
  }
  // Sort: hls first, mp4 second, embed last
  classified.sort((a, b) => {
    const order: Record<SourceType, number> = { hls: 0, mp4: 1, embed: 2 };
    return order[a.type] - order[b.type];
  });
  return classified;
}

export default function AnimePlayer({ sources, title, onProgress, autoplay = true }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [classified, setClassified] = useState<ClassifiedSource[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showServerPicker, setShowServerPicker] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const c = classifySources(sources);
    setClassified(c);
    setCurrentIdx(0);
    setError(false);
    setLoading(true);
  }, [sources]);

  const currentSource = classified[currentIdx];

  const tryNext = useCallback(() => {
    if (currentIdx + 1 < classified.length) {
      setCurrentIdx((i) => i + 1);
      setError(false);
      setLoading(true);
    } else {
      setError(true);
      setLoading(false);
    }
  }, [currentIdx, classified.length]);

  // HLS / MP4 setup
  useEffect(() => {
    if (!currentSource || currentSource.type === "embed") return;
    const video = videoRef.current;
    if (!video) return;

    // Cleanup previous HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (currentSource.type === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(currentSource.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          if (autoplay) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) tryNext();
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = currentSource.url;
        video.addEventListener("loadedmetadata", () => {
          setLoading(false);
          if (autoplay) video.play().catch(() => {});
        }, { once: true });
      } else {
        tryNext();
      }
    } else {
      // MP4
      video.src = currentSource.url;
      video.addEventListener("loadeddata", () => {
        setLoading(false);
        if (autoplay) video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => tryNext(), { once: true });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource, autoplay, tryNext]);

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource || currentSource.type === "embed") return;

    const onTimeUpdate = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
      if (video.duration > 0) {
        const pct = video.currentTime / video.duration;
        onProgress?.(pct);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [currentSource, onProgress]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen();
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * duration;
  };

  const showControlsTemp = () => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000);
  };

  const selectServer = (idx: number) => {
    setCurrentIdx(idx);
    setError(false);
    setLoading(true);
    setShowServerPicker(false);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Embed fallback
  if (currentSource?.type === "embed") {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <iframe
          src={currentSource.url}
          className="w-full h-full border-0"
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          title={title}
        />
        {classified.length > 1 && (
          <div className="absolute top-2 right-2 z-20">
            <button onClick={() => setShowServerPicker(!showServerPicker)} className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs flex items-center gap-1 hover:bg-black/90 transition">
              <Server className="w-3 h-3" /> {currentSource.name}
            </button>
            {showServerPicker && (
              <div className="absolute right-0 top-full mt-1 bg-black/90 rounded-lg p-2 min-w-[140px] z-30">
                {classified.map((s, i) => (
                  <button key={i} onClick={() => selectServer(i)} className={`w-full text-left px-3 py-1.5 rounded text-xs transition ${i === currentIdx ? "bg-primary text-primary-foreground" : "text-white hover:bg-white/10"}`}>
                    {s.name} ({s.type})
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Native video player
  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden group cursor-pointer"
      onMouseMove={showControlsTemp}
      onClick={togglePlay}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3">
          <p className="text-sm text-muted-foreground">No se pudo reproducir</p>
          <button onClick={() => { setCurrentIdx(0); setError(false); setLoading(true); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold">
            Reintentar
          </button>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        muted={muted}
      />

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 z-10 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
          <p className="text-xs text-white font-medium truncate">{title}</p>
          <div className="relative">
            <button onClick={() => setShowServerPicker(!showServerPicker)} className="px-2 py-1 rounded bg-black/50 text-white text-[10px] flex items-center gap-1 hover:bg-black/80 transition">
              <Server className="w-3 h-3" /> {currentSource?.name || "—"}
            </button>
            {showServerPicker && (
              <div className="absolute right-0 top-full mt-1 bg-black/90 rounded-lg p-2 min-w-[140px] z-30">
                {classified.map((s, i) => (
                  <button key={i} onClick={() => selectServer(i)} className={`w-full text-left px-3 py-1.5 rounded text-xs transition ${i === currentIdx ? "bg-primary text-primary-foreground" : "text-white hover:bg-white/10"}`}>
                    {s.name} ({s.type})
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center play button */}
        {!playing && !loading && !error && (
          <button onClick={togglePlay} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="w-7 h-7 text-primary-foreground fill-current ml-1" />
          </button>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          {/* Progress bar */}
          <div onClick={seekTo} className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/bar">
            <div className="h-full bg-primary rounded-full relative transition-all" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-primary transition">
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-primary transition">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <span className="text-[10px] text-white/70 tabular-nums">
                {formatTime(progress)} / {formatTime(duration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleFullscreen} className="text-white hover:text-primary transition">
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
