import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Pause, Play, Maximize, Minimize, Volume2, VolumeX, Server, Loader2, AlertCircle, SkipBack, SkipForward, Zap, X, List } from "lucide-react";
import { isWebView } from "@/lib/webview";
import { getSeekeEpisode } from "@/lib/zetapi";

export interface PlayerSource {
  name: string;
  embed?: string;
  url?: string;
  type?: string; // "hls" | "embed" | etc from API
  episode?: number;
}

interface Props {
  sources: PlayerSource[];
  title?: string;
  onProgress?: (progress: number) => void;
  /** Llamado cuando el usuario hace seek manual (adelanta/retrocede). */
  onSeeked?: (currentTime: number, duration: number) => void;
  autoplay?: boolean;
  initialTime?: number;
  showServerPicker?: boolean;
  episodeKey?: string;
  canPrev?: boolean;
  canNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onAutoNext?: () => void;
  autoNextAlreadyTriggered?: boolean;
  currentEpisode?: number;
  totalEpisodes?: number;
  onSelectEpisode?: (ep: number) => void;
}

type SourceType = "hls" | "mp4" | "embed" | "html" | "seeke";

interface ClassifiedSource {
  type: SourceType;
  url: string;
  name: string;
  episode?: number;
}

function classifySources(sources: PlayerSource[]): ClassifiedSource[] {
  const classified: ClassifiedSource[] = [];
  for (const s of sources) {
    const rawUrl = s.embed || s.url || "";
    const url = rawUrl.trim();
    if (!url) continue;

    // Use API-provided type if available
    if (/<iframe|<video/i.test(url)) {
      classified.push({ type: "html", url, name: s.name, episode: s.episode });
    } else if (s.type === "seeke") {
      classified.push({ type: "seeke", url, name: s.name, episode: s.episode });
    } else if (s.type === "hls" || url.includes(".m3u8")) {
      classified.push({ type: "hls", url, name: s.name });
    } else if (url.includes(".mp4")) {
      classified.push({ type: "mp4", url, name: s.name });
    } else {
      classified.push({ type: "embed", url, name: s.name });
    }
  }
  // Sort: HLS first, then mp4, then embed
  classified.sort((a, b) => {
    const order: Record<SourceType, number> = { seeke: 0, hls: 1, mp4: 2, embed: 3, html: 3 };
    return order[a.type] - order[b.type];
  });
  return classified;
}

export default function AnimePlayer({ sources, title, onProgress, onSeeked, autoplay = true, initialTime, showServerPicker: showServerPickerEnabled = true, episodeKey, canPrev, canNext, onPrev, onNext, onAutoNext, autoNextAlreadyTriggered, currentEpisode, totalEpisodes, onSelectEpisode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Estabilizamos por contenido para evitar microreinicios cuando el padre re-renderiza con misma data
  const sourcesKey = useMemo(
    () => sources.map((s) => `${s.type || ""}|${s.embed || s.url || ""}|${s.episode ?? ""}`).join("¶"),
    [sources]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const classified = useMemo(() => classifySources(sources), [sourcesKey]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showServerPicker, setShowServerPicker] = useState(false);
  const [showEpList, setShowEpList] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoNextVisible, setAutoNextVisible] = useState(false);
  const [autoNextSeconds, setAutoNextSeconds] = useState(15);
  const [playPulse, setPlayPulse] = useState(false);
  const controlsTimer = useRef<ReturnType<typeof setTimeout>>();
  const autoNextTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoNextCountdownStarted = useRef(false);
  const autoNextCancelled = useRef(false);
  const hasRestoredTime = useRef(false);
  const inWebView = isWebView();

  useEffect(() => {
    setCurrentIdx(0);
    setError(false);
    setLoading(true);
    hasRestoredTime.current = false;
    autoNextCountdownStarted.current = false;
    autoNextCancelled.current = false;
    setAutoNextVisible(false);
    setAutoNextSeconds(15);
    if (autoNextTimer.current) clearInterval(autoNextTimer.current);
  }, [classified]);

  useEffect(() => {
    autoNextCountdownStarted.current = false;
    autoNextCancelled.current = false;
    setAutoNextVisible(false);
    setAutoNextSeconds(15);
    if (autoNextTimer.current) clearInterval(autoNextTimer.current);
  }, [episodeKey]);

  const currentSource = classified[currentIdx];

  // Auto-fallback to next server on error
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

  const restoreTime = useCallback(() => {
    if (hasRestoredTime.current || !initialTime || initialTime <= 0) return;
    const video = videoRef.current;
    if (!video) return;
    hasRestoredTime.current = true;
    video.currentTime = initialTime;
  }, [initialTime]);

  // Seeke / HLS / MP4 setup
  useEffect(() => {
    if (!currentSource || currentSource.type === "embed" || currentSource.type === "html") return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const attachHls = (videoUrl: string) => {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          restoreTime();
          if (autoplay) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) tryNext();
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
        video.addEventListener("loadedmetadata", () => {
          setLoading(false);
          restoreTime();
          if (autoplay) video.play().catch(() => {});
        }, { once: true });
        video.addEventListener("error", () => tryNext(), { once: true });
      } else {
        tryNext();
      }
    };

    if (currentSource.type === "seeke") {
      setLoading(true);
      getSeekeEpisode(currentSource.url, currentSource.episode || 1)
        .then((data) => {
          if (!cancelled) attachHls(data.embed);
        })
        .catch(() => {
          if (!cancelled) tryNext();
        });
    } else if (currentSource.type === "hls") {
      attachHls(currentSource.url);
    } else {
      video.src = currentSource.url;
      video.addEventListener("loadeddata", () => {
        setLoading(false);
        restoreTime();
        if (autoplay) video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => tryNext(), { once: true });
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentSource, autoplay, tryNext, restoreTime]);

  const cancelAutoNext = useCallback(() => {
    autoNextCancelled.current = true;
    autoNextCountdownStarted.current = false;
    setAutoNextVisible(false);
    setAutoNextSeconds(15);
    if (autoNextTimer.current) {
      clearInterval(autoNextTimer.current);
      autoNextTimer.current = null;
    }
  }, []);

  // Progress tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentSource || currentSource.type === "embed" || currentSource.type === "html") return;

    const onTimeUpdate = () => {
      setProgress(video.currentTime);
      setDuration(video.duration || 0);
      if (video.duration > 0) {
        onProgress?.(video.currentTime / video.duration);
        const remaining = video.duration - video.currentTime;
        if (
          onAutoNext &&
          canNext &&
          !autoNextAlreadyTriggered &&
          !autoNextCancelled.current &&
          !autoNextCountdownStarted.current &&
          remaining <= 30 &&
          remaining > 15
        ) {
          autoNextCountdownStarted.current = true;
          setAutoNextVisible(true);
          setAutoNextSeconds(15);
          autoNextTimer.current = setInterval(() => {
            setAutoNextSeconds((seconds) => {
              if (seconds <= 1) {
                if (autoNextTimer.current) clearInterval(autoNextTimer.current);
                autoNextTimer.current = null;
                setAutoNextVisible(false);
                onAutoNext();
                return 0;
              }
              return seconds - 1;
            });
          }, 1000);
        }
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onSeek = () => {
      if (video.duration > 0) onSeeked?.(video.currentTime, video.duration);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("seeked", onSeek);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("seeked", onSeek);
      if (autoNextTimer.current) {
        clearInterval(autoNextTimer.current);
        autoNextTimer.current = null;
      }
    };
  }, [currentSource, onProgress, onSeeked, onAutoNext, canNext, autoNextAlreadyTriggered]);

  // Fullscreen: lock landscape on mobile/webview
  useEffect(() => {
    const onFsChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: OrientationLockType) => Promise<void>;
        unlock?: () => void;
      };
      if (isFull && (inWebView || /Mobi|Android/i.test(navigator.userAgent))) {
        try { orientation.lock?.("landscape").catch(() => undefined); } catch { void 0; }
      } else {
        try { orientation.unlock?.(); } catch { void 0; }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [inWebView]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setPlayPulse(true);
      window.setTimeout(() => setPlayPulse(false), 850);
      video.play();
    } else {
      video.pause();
    }
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

  // En APK/móvil los controles deben quedar visibles bastante más tiempo.
  // En PC con mouse → 3s tras dejar de moverlo o salir.
  const isMobileLike = inWebView || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const HIDE_MS = isMobileLike ? 6500 : 3000;

  const skip90 = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = Math.min(video.duration, video.currentTime + 90);
    setSeekFlash("fwd");
    setTimeout(() => setSeekFlash(null), 500);
  };

  const scheduleControlsHide = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), HIDE_MS);
  }, [HIDE_MS]);

  const showControlsTemp = useCallback(() => {
    setShowControls(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  const toggleControls = useCallback(() => {
    setShowControls((visible) => {
      const next = !visible;
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      if (next) {
        controlsTimer.current = setTimeout(() => setShowControls(false), HIDE_MS);
      }
      return next;
    });
  }, [HIDE_MS]);

  // Double-tap seek (±10s) — sensor independiente que SIEMPRE arma con cada tap.
  // Ventana 380ms entre taps; si entran 2 dentro de la ventana en el mismo lado del player → ±10s.
  // El single tap (toggle controles) se dispara con un timer corto que se cancela si llega un 2do tap.
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekFlash, setSeekFlash] = useState<null | "back" | "fwd">(null);

  const handleContainerTap = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-player-control="true"]')) return;
    if (showEpList) setShowEpList(false);
    const video = videoRef.current;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";
    const last = lastTapRef.current;

    // DOBLE TAP — sensor INDEPENDIENTE: nunca toca la visibilidad de controles.
    // Ventana 360ms entre taps en el mismo lado → ±10s. Re-armable infinitas veces.
    if (last && now - last.time < 360 && last.side === side && video && video.duration) {
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      const delta = side === "left" ? -10 : 10;
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
      setSeekFlash(null);
      // micro-tick para reanimar aunque se repita rápido
      requestAnimationFrame(() => setSeekFlash(side === "left" ? "back" : "fwd"));
      setTimeout(() => setSeekFlash(null), 480);
      // re-armamos para permitir cadena de double-taps
      lastTapRef.current = { time: now, side };
      return;
    }

    // TAP SIMPLE → toggle controles, con delay corto para no chocar con un 2do tap
    lastTapRef.current = { time: now, side };
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      toggleControls();
      singleTapTimer.current = null;
    }, 300);
  };

  const selectServer = (idx: number) => {
    setCurrentIdx(idx);
    setError(false);
    setLoading(true);
    setShowServerPicker(false);
    hasRestoredTime.current = false;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Server picker UI (shared between embed and native)
  const ServerPicker = () => (
    <div className="absolute top-2 right-2 z-20">
      <button onClick={(e) => { e.stopPropagation(); setShowServerPicker(!showServerPicker); }}
        className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs flex items-center gap-1 hover:bg-black/90 transition">
        <Server className="w-3 h-3" /> {currentSource?.name || "Servidor"}
      </button>
      {showServerPicker && (
        <div className="absolute right-0 top-full mt-1 bg-black/90 backdrop-blur rounded-lg p-2 min-w-[160px] z-30 max-h-[200px] overflow-y-auto">
          {classified.map((s, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); selectServer(i); }}
              className={`w-full text-left px-3 py-2 rounded text-xs transition flex items-center justify-between gap-2 ${i === currentIdx ? "bg-primary text-primary-foreground" : "text-white hover:bg-white/10"}`}>
              <span>{s.name}</span>
              {s.type !== "seeke" && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.type === "hls" ? "bg-green-500/20 text-green-400" : s.type === "mp4" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                  {s.type.toUpperCase()}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Embed mode: usar el player externo si viene como iframe/video embebido o URL de reproductor.
  if (currentSource?.type === "embed" || currentSource?.type === "html") {
    return (
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        {currentSource.type === "html" ? (
          <div className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_video]:w-full [&_video]:h-full" dangerouslySetInnerHTML={{ __html: currentSource.url }} />
        ) : (
          <iframe
            src={currentSource.url}
            className="w-full h-full border-0"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            title={title}
          />
        )}
        {showServerPickerEnabled && classified.length > 1 && <ServerPicker />}
      </div>
    );
  }

  // Native video player
  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-xl overflow-hidden group cursor-pointer select-none"
      onMouseMove={() => { if (!isMobileLike) showControlsTemp(); }}
      onMouseLeave={() => {
        if (isMobileLike) return;
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        controlsTimer.current = setTimeout(() => setShowControls(false), HIDE_MS);
      }}
      onPointerUp={handleContainerTap}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3 bg-black/80">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">No se pudo reproducir</p>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIdx(0); setError(false); setLoading(true); }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold">
            Reintentar
          </button>
        </div>
      )}

      <video ref={videoRef} className="w-full h-full object-contain" playsInline muted={muted} />

      {playPulse && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <Zap className="w-16 h-16 text-primary fill-current animate-[zet-pop-fade_0.85s_cubic-bezier(0.16,1,0.3,1)_forwards] drop-shadow-[0_0_26px_hsl(var(--primary))]" />
        </div>
      )}

      {/* Flash de double-tap seek ±10s */}
      {seekFlash && (
        <div className={`pointer-events-none absolute inset-y-0 ${seekFlash === "back" ? "left-0" : "right-0"} w-1/2 z-30 flex items-center justify-center bg-primary/10 backdrop-blur-[1px] animate-[zet-pop-fade_0.5s_ease-out_forwards]`}>
          <div className="flex flex-col items-center gap-1 text-primary drop-shadow-[0_0_14px_hsl(var(--primary))]">
            {seekFlash === "back" ? <SkipBack className="w-10 h-10 fill-current" /> : <SkipForward className="w-10 h-10 fill-current" />}
            <span className="text-sm font-bold">10s</span>
          </div>
        </div>
      )}

      {autoNextVisible && (
        <div className="absolute right-3 bottom-20 z-30 w-[min(92vw,320px)] rounded-xl border border-primary/50 bg-background/92 backdrop-blur px-4 py-3 shadow-[0_0_24px_hsl(var(--primary)/0.35)]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 flex-shrink-0 rounded-full border border-primary/40 flex items-center justify-center">
              <Loader2 className="absolute h-10 w-10 text-primary animate-spin" />
              <Zap className="h-5 w-5 text-primary fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground">Salto automático</p>
              <p className="text-[11px] text-muted-foreground">Siguiente episodio en {autoNextSeconds}s</p>
            </div>
            <button onClick={cancelAutoNext} className="h-8 w-8 rounded-md bg-secondary text-foreground hover:text-primary border border-border flex items-center justify-center transition" aria-label="Cancelar salto automático">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Controls overlay — bloqueado por completo cuando está oculto para evitar clics fantasma */}
      <div
        data-player-control="true"
        className={`absolute inset-0 z-10 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar with server picker — nombre se muestra como "Pro" */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
          <p className="text-xs text-white font-medium truncate flex-1 mr-2">{title}</p>
          {showServerPickerEnabled && classified.length > 1 && (
            <div className="relative">
              <button onClick={() => setShowServerPicker(!showServerPicker)}
                className="px-2 py-1 rounded bg-black/50 text-white text-[10px] flex items-center gap-1 hover:bg-black/80 transition">
                <Server className="w-3 h-3" /> Pro
              </button>
              {showServerPicker && (
                <div className="absolute right-0 top-full mt-1 bg-black/90 backdrop-blur rounded-lg p-2 min-w-[160px] z-30 max-h-[200px] overflow-y-auto">
                  {classified.map((s, i) => (
                    <button key={i} onClick={() => selectServer(i)}
                      className={`w-full text-left px-3 py-2 rounded text-xs transition flex items-center justify-between gap-2 ${i === currentIdx ? "bg-primary text-primary-foreground" : "text-white hover:bg-white/10"}`}>
                      <span>Pro {i + 1}</span>
                      {s.type !== "seeke" && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.type === "hls" ? "bg-green-500/20 text-green-400" : s.type === "mp4" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {s.type.toUpperCase()}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center episode controls — botones reducidos ~50% en móvil para no cubrir tanto */}
        {!loading && !error && (
          <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 sm:gap-7">
            <button onClick={(e) => { e.stopPropagation(); onPrev?.(); }} disabled={!canPrev} className="h-8 w-8 sm:h-14 sm:w-14 rounded-full bg-background/70 border border-primary/45 flex items-center justify-center text-foreground hover:text-primary hover:border-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95" aria-label="Episodio anterior">
              <SkipBack className="h-4 w-4 sm:h-7 sm:w-7" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="relative h-12 w-12 sm:h-20 sm:w-20 rounded-full bg-background/80 border-2 border-primary/70 flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_28px_hsl(var(--primary)/0.55)] before:absolute before:inset-2 before:rounded-full before:border before:border-primary/35" aria-label={playing ? "Pausar" : "Reproducir"}>
              {playing ? (
                <Play className="relative h-6 w-6 sm:h-10 sm:w-10 text-primary fill-current drop-shadow-[0_0_14px_hsl(var(--primary))]" />
              ) : (
                <Zap className="relative h-7 w-7 sm:h-11 sm:w-11 text-primary fill-current drop-shadow-[0_0_14px_hsl(var(--primary))]" />
              )}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onNext?.(); }} disabled={!canNext} className="h-8 w-8 sm:h-14 sm:w-14 rounded-full bg-background/70 border border-primary/45 flex items-center justify-center text-foreground hover:text-primary hover:border-primary disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95" aria-label="Episodio siguiente">
              <SkipForward className="h-4 w-4 sm:h-7 sm:w-7" />
            </button>
          </div>
        )}

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          <div onClick={seekTo} className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/bar">
            <div className="h-full bg-primary rounded-full relative transition-all" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-primary transition">
                {playing ? <Play className="w-5 h-5 fill-current" /> : <Zap className="w-5 h-5 fill-current" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-primary transition">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); skip90(); }}
                className="px-2 py-0.5 rounded-md border border-primary/50 text-[10px] font-bold text-white hover:bg-primary/20 hover:text-primary transition flex items-center gap-1"
                aria-label="Saltar 1:30"
                title="Saltar opening/ending (+1:30)"
              >
                <SkipForward className="w-3 h-3" /> +1:30
              </button>
              <span className="text-[10px] text-white/70 tabular-nums">
                {formatTime(progress)} / {formatTime(duration)}
              </span>
              {currentEpisode != null && totalEpisodes && totalEpisodes > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEpList((v) => !v); }}
                    className="px-2 py-0.5 rounded-md border border-primary/50 text-[10px] font-bold text-white hover:bg-primary/20 hover:text-primary transition flex items-center gap-1"
                    aria-label="Lista de episodios"
                    title="Lista de episodios"
                  >
                    <List className="w-3 h-3" /> {currentEpisode}/{totalEpisodes}
                  </button>
                  {showEpList && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 bottom-full mb-2 bg-black/95 backdrop-blur rounded-lg p-2 z-40 shadow-[0_0_24px_hsl(var(--primary)/0.4)] border border-primary/40 w-[220px] max-h-[220px] overflow-y-auto"
                    >
                      <div className="grid grid-cols-4 gap-1">
                        {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((n) => (
                          <button
                            key={n}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowEpList(false);
                              onSelectEpisode?.(n);
                            }}
                            className={`px-1 py-1.5 rounded text-[11px] font-bold transition ${
                              n === currentEpisode
                                ? "bg-primary text-primary-foreground"
                                : "bg-white/10 text-white hover:bg-primary/30"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-primary transition">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
