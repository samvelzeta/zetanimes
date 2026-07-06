import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Pause, Play, Maximize, Minimize, Volume2, VolumeX, Server, Loader2, AlertCircle, SkipBack, SkipForward, Zap, X, List, ChevronLeft, ChevronRight, Captions, CaptionsOff, Gauge, Check } from "lucide-react";
import { isWebView } from "@/lib/webview";
import { getSeekeEpisode } from "@/lib/zetapi";

export interface PlayerSubtitle {
  lang: string;
  url: string;
  label?: string;
}

export interface PlayerSource {
  name: string;
  embed?: string;
  url?: string;
  type?: string; // "hls" | "embed" | etc from API
  episode?: number;
}

const EMPTY_PLAYER_SUBTITLES: PlayerSubtitle[] = [];

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
  subtitles?: PlayerSubtitle[];
  fullscreenContainerRef?: React.RefObject<HTMLElement>;
}

type SourceType = "hls" | "mp4" | "embed" | "html" | "seeke";

interface ParsedSubtitleCue {
  start: number;
  end: number;
  text: string;
}

interface ClassifiedSource {
  type: SourceType;
  url: string;
  name: string;
  episode?: number;
}

const SRT_CACHE_VERSION = "v1";
const SRT_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;

function srtTimeToSeconds(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, "0")) / 1000;
}

function parseSrt(raw: string): ParsedSubtitleCue[] {
  const normalized = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").replace(/\\n/g, "\n").trim();
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeIndex === -1) return null;
      const [startRaw, endRaw] = lines[timeIndex].split("-->").map((part) => part.trim().split(/\s+/)[0]);
      const text = lines.slice(timeIndex + 1).join("\n").replace(/<[^>]+>/g, "").trim();
      if (!startRaw || !endRaw || !text) return null;
      return { start: srtTimeToSeconds(startRaw), end: srtTimeToSeconds(endRaw), text };
    })
    .filter((cue): cue is ParsedSubtitleCue => !!cue && cue.end > cue.start)
    .sort((a, b) => a.start - b.start);
}

function getSubtitleLanguage(sub: PlayerSubtitle) {
  const haystack = `${sub.lang || ""} ${sub.label || ""} ${decodeURIComponent(sub.url || "")}`.toLowerCase();
  const has = (re: RegExp) => re.test(haystack);
  if (has(/(?:^|[^a-z])(es|esp|spa|spanish|espanol|español|castellano)(?:[^a-z]|$)/)) return { code: "es", label: "Español" };
  if (has(/(?:^|[^a-z])(en|eng|english)(?:[^a-z]|$)/)) return { code: "en", label: "Inglés" };
  if (has(/(?:^|[^a-z])(ar|ara|arabic)(?:[^a-z]|$)/)) return { code: "ar", label: "Árabe" };
  if (has(/(?:^|[^a-z])(tr|tur|turkish)(?:[^a-z]|$)/)) return { code: "tr", label: "Turco" };
  if (has(/(?:^|[^a-z])(pt|por|portuguese|português)(?:[^a-z]|$)/)) return { code: "pt", label: "Portugués" };
  if (has(/(?:^|[^a-z])(fil|tl|tagalog)(?:[^a-z]|$)/)) return { code: "fil", label: "Filipino" };
  if (has(/(?:^|[^a-z])(th|tha|thai)(?:[^a-z]|$)/)) return { code: "th", label: "Tailandés" };
  if (has(/(?:^|[^a-z])(ms|may|malay)(?:[^a-z]|$)/)) return { code: "ms", label: "Malayo" };
  if (has(/(?:^|[^a-z])(chs|cht|zh|chi|chinese)(?:[^a-z]|$)/)) return { code: "zh", label: "Chino" };
  if (has(/(?:^|[^a-z])(ja|jp|jpn|japanese)(?:[^a-z]|$)/)) return { code: "ja", label: "Japonés" };
  return { code: "sub", label: sub.lang || sub.label || "Subtítulo" };
}

function getPreferredSubtitle(subtitles: PlayerSubtitle[]) {
  return subtitles.find((sub) => getSubtitleLanguage(sub).code === "es") || subtitles[0] || null;
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

export default function AnimePlayer({ sources, title, onProgress, onSeeked, autoplay = true, initialTime, showServerPicker: showServerPickerEnabled = true, episodeKey, canPrev, canNext, onPrev, onNext, onAutoNext, autoNextAlreadyTriggered, currentEpisode, totalEpisodes, onSelectEpisode, subtitles = EMPTY_PLAYER_SUBTITLES, fullscreenContainerRef }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const epScrollRef = useRef<HTMLDivElement>(null);
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
  const [subsActive, setSubsActive] = useState(true);
  const [seekeSubs, setSeekeSubs] = useState<PlayerSubtitle[]>([]);
  const effectiveSubtitles = useMemo(() => subtitles.length > 0 ? subtitles : seekeSubs, [subtitles, seekeSubs]);
  const subsKey = useMemo(() => effectiveSubtitles.map((s) => `${s.lang}|${s.url}`).join("¶"), [effectiveSubtitles]);
  const [selectedSubtitleUrl, setSelectedSubtitleUrl] = useState<string | null>(null);
  const [parsedSubtitleCues, setParsedSubtitleCues] = useState<ParsedSubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState("");
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const subtitleOptions = useMemo(
    () => effectiveSubtitles.map((sub, index) => ({ sub, index, language: getSubtitleLanguage(sub) })),
    [effectiveSubtitles]
  );
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

  // Apply playback speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, currentIdx]);



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

  // Seeke / HLS / MP4 setup — DESTROY → CLEAN → REBUILD en cada cambio de episodio/servidor.
  useEffect(() => {
    if (!currentSource || currentSource.type === "embed" || currentSource.type === "html") return;
    const video = videoRef.current;
    if (!video) return;
    const abort = new AbortController();
    let cancelled = false;

    // Limpieza dura previa: evita que se reutilicen buffers/instancias del episodio anterior.
    const hardCleanup = () => {
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { void 0; }
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute("src");
        // Quita cualquier <source> hijo y fuerza al elemento a olvidar el stream anterior.
        while (video.firstChild) video.removeChild(video.firstChild);
        video.load();
      } catch { void 0; }
    };

    hardCleanup();

    const attachHls = (videoUrl: string) => {
      if (cancelled) return;
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 0, // no compartir buffers entre episodios
        });
        hlsRef.current = hls;
        hls.loadSource(videoUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (cancelled) return;
          setLoading(false);
          restoreTime();
          if (autoplay) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal && !cancelled) tryNext();
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = videoUrl;
        video.addEventListener("loadedmetadata", () => {
          if (cancelled) return;
          setLoading(false);
          restoreTime();
          if (autoplay) video.play().catch(() => {});
        }, { once: true });
        video.addEventListener("error", () => { if (!cancelled) tryNext(); }, { once: true });
      } else {
        tryNext();
      }
    };

    if (currentSource.type === "seeke") {
      setLoading(true);
      setSeekeSubs([]);
      getSeekeEpisode(currentSource.url, currentSource.episode || 1)
        .then((data) => {
          if (cancelled || abort.signal.aborted) return;
          if (Array.isArray(data.subtitles)) setSeekeSubs(data.subtitles);
          attachHls(data.embed);
        })
        .catch(() => {
          if (!cancelled) tryNext();
        });
    } else if (currentSource.type === "hls") {
      attachHls(currentSource.url);
    } else {
      video.src = currentSource.url;
      video.addEventListener("loadeddata", () => {
        if (cancelled) return;
        setLoading(false);
        restoreTime();
        if (autoplay) video.play().catch(() => {});
      }, { once: true });
      video.addEventListener("error", () => { if (!cancelled) tryNext(); }, { once: true });
    }

    return () => {
      cancelled = true;
      abort.abort();
      hardCleanup();
    };
  }, [currentSource, episodeKey, autoplay, tryNext, restoreTime]);

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

  const getFullscreenTarget = useCallback(() => fullscreenContainerRef?.current || containerRef.current, [fullscreenContainerRef]);

  // Fullscreen: lock landscape on mobile/webview
  useEffect(() => {
    const onFsChange = () => {
      const target = getFullscreenTarget();
      const active = document.fullscreenElement;
      const isFull = !!active && !!target && (active === target || active.contains(target) || target.contains(active));
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
  }, [inWebView, getFullscreenTarget]);

  // ── Custom SRT renderer: lee el .srt, lo parsea y lo pinta sobre el video ──
  useEffect(() => {
    const preferred = getPreferredSubtitle(effectiveSubtitles);
    setSelectedSubtitleUrl(preferred?.url || null);
    setParsedSubtitleCues([]);
    setActiveSubtitleText("");
    setShowSubtitleMenu(false);
  }, [effectiveSubtitles, episodeKey, currentSource?.url]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) Array.from(video.querySelectorAll("track")).forEach((track) => track.remove());

    if (!subsActive || !selectedSubtitleUrl) {
      setParsedSubtitleCues([]);
      setActiveSubtitleText("");
      return;
    }

    const selected = effectiveSubtitles.find((sub) => sub.url === selectedSubtitleUrl);
    if (!selected) return;

    const cacheKey = `zet:srt:${SRT_CACHE_VERSION}:${episodeKey || currentSource?.episode || "ep"}:${selected.url}`;
    let cancelled = false;

    const unpack = (packed: [number, number, string][]) => packed.map(([start, end, text]) => ({ start, end, text }));

    (async () => {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null") as { expiresAt: number; cues: [number, number, string][] } | null;
        if (cached?.expiresAt && cached.expiresAt > Date.now() && Array.isArray(cached.cues)) {
          if (!cancelled) setParsedSubtitleCues(unpack(cached.cues));
          return;
        }
      } catch {
        void 0;
      }

      const PROXY_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/subtitle-proxy`;
      const fetchStrategies: Array<() => Promise<string>> = [
        // 1) VPS-style proxy propio (server-side download con headers correctos) — más confiable
        async () => {
          const r = await fetch(PROXY_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: selected.url }),
          });
          if (!r.ok) throw new Error(`subtitle-proxy ${r.status}`);
          const j = await r.json();
          if (!j?.ok || !j?.content) throw new Error(j?.error || "subtitle-proxy empty");
          return String(j.content);
        },
        // 2) directo
        async () => {
          const r = await fetch(selected.url, { headers: { Accept: "application/x-subrip,text/plain,*/*" } });
          if (!r.ok) throw new Error(`direct ${r.status}`);
          return await r.text();
        },
        // 3) allorigins.win (raw)
        async () => {
          const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(selected.url)}`);
          if (!r.ok) throw new Error(`allorigins-raw ${r.status}`);
          return await r.text();
        },
        // 4) allorigins.win (get + json)
        async () => {
          const r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(selected.url)}`);
          if (!r.ok) throw new Error(`allorigins-get ${r.status}`);
          const j = await r.json();
          if (!j?.contents) throw new Error("allorigins-empty");
          return String(j.contents);
        },
        // 5) corsproxy.io
        async () => {
          const r = await fetch(`https://corsproxy.io/?${encodeURIComponent(selected.url)}`);
          if (!r.ok) throw new Error(`corsproxy ${r.status}`);
          return await r.text();
        },
      ];

      let srtText = "";
      let lastErr: unknown = null;
      for (const strat of fetchStrategies) {
        if (cancelled) return;
        try {
          srtText = await strat();
          if (srtText && srtText.trim().length > 10) break;
        } catch (e) {
          lastErr = e;
        }
      }

      if (!srtText || srtText.trim().length < 10) {
        if (!cancelled) {
          // Limpiar caché para que el reintento funcione cuando se arregle la URL
          try { localStorage.removeItem(cacheKey); } catch { void 0; }
          setParsedSubtitleCues([]);
          setActiveSubtitleText("");
          console.warn("[Subs] No se pudo cargar el SRT por ningún método", { url: selected.url, lastErr });
        }
        return;
      }

      const cues = parseSrt(srtText);
      console.log(`[Subs] SRT cargado: ${cues.length} cues — ${selected.url}`);
      if (cancelled) return;
      if (cues.length === 0) {
        try { localStorage.removeItem(cacheKey); } catch { void 0; }
        setParsedSubtitleCues([]);
        setActiveSubtitleText("");
        return;
      }
      setParsedSubtitleCues(cues);
      try {
        const packed = cues.map((cue) => [Number(cue.start.toFixed(3)), Number(cue.end.toFixed(3)), cue.text] as [number, number, string]);
        localStorage.setItem(cacheKey, JSON.stringify({ expiresAt: Date.now() + SRT_CACHE_TTL, cues: packed }));
      } catch {
        void 0;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSubtitleUrl, subsActive, effectiveSubtitles, episodeKey, currentSource?.episode]);

  // Motor de subtítulos: render loop con rAF + fallback setInterval cuando la pestaña va en background.
  // Usa búsqueda binaria sobre los cues y se reinicia ante seek/fullscreen/visibility/loadedmetadata.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subsActive || parsedSubtitleCues.length === 0) {
      setActiveSubtitleText("");
      return;
    }

    const cues = parsedSubtitleCues;
    let rafId = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let lastIdx = -1;
    let lastText = "";

    const findCueIdx = (t: number): number => {
      let lo = 0, hi = cues.length - 1, ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = cues[mid];
        if (t < c.start) hi = mid - 1;
        else if (t > c.end) lo = mid + 1;
        else { ans = mid; break; }
      }
      return ans;
    };

    const tick = () => {
      const now = video.currentTime;
      const idx = findCueIdx(now);
      const text = idx >= 0 ? cues[idx].text : "";
      if (idx !== lastIdx || text !== lastText) {
        lastIdx = idx;
        lastText = text;
        setActiveSubtitleText(text);
      }
    };

    const startLoop = () => {
      stopLoop();
      const loop = () => {
        tick();
        rafId = requestAnimationFrame(loop);
      };
      rafId = requestAnimationFrame(loop);
      // Fallback: si el rAF se pausa (pestaña en background, iOS lockscreen),
      // setInterval garantiza que el overlay siga sincronizado.
      intervalId = setInterval(tick, 250);
    };
    const stopLoop = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (intervalId) clearInterval(intervalId);
      rafId = 0;
      intervalId = null;
    };

    const forceResync = () => { lastIdx = -1; lastText = ""; tick(); };
    const onVisibility = () => { if (!document.hidden) forceResync(); };

    startLoop();
    video.addEventListener("seeking", forceResync);
    video.addEventListener("seeked", forceResync);
    video.addEventListener("play", forceResync);
    video.addEventListener("pause", tick);
    video.addEventListener("waiting", tick);
    video.addEventListener("loadedmetadata", forceResync);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("fullscreenchange", forceResync);

    return () => {
      stopLoop();
      video.removeEventListener("seeking", forceResync);
      video.removeEventListener("seeked", forceResync);
      video.removeEventListener("play", forceResync);
      video.removeEventListener("pause", tick);
      video.removeEventListener("waiting", tick);
      video.removeEventListener("loadedmetadata", forceResync);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("fullscreenchange", forceResync);
      setActiveSubtitleText("");
    };
  }, [parsedSubtitleCues, subsActive, currentSource?.url]);

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
    const el = getFullscreenTarget();
    if (!el) return;
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: OrientationLockType) => Promise<void>;
      unlock?: () => void;
    };
    if (document.fullscreenElement) {
      try { orientation.unlock?.(); } catch { void 0; }
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.().then(() => {
        if (inWebView || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
          try { orientation.lock?.("landscape").catch(() => undefined); } catch { void 0; }
        }
      }).catch(() => undefined);
    }
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    video.currentTime = pct * duration;
  };

  // El tap simple siempre deja los controles visibles al menos 5s antes de ocultarlos.
  const isMobileLike = inWebView || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const HIDE_MS = 3000;
  const DOUBLE_TAP_MS = 300;
  const SINGLE_TAP_DELAY_MS = 340;

  const skip90 = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    video.currentTime = Math.min(video.duration, video.currentTime + 90);
    setSeekFlash("fwd");
    setTimeout(() => setSeekFlash(null), 500);
  };

  const scheduleControlsHide = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (showEpList) return; // no ocultar mientras el menú de episodios esté abierto
    controlsTimer.current = setTimeout(() => setShowControls(false), HIDE_MS);
  }, [HIDE_MS, showEpList]);

  const showControlsTemp = useCallback(() => {
    setShowControls(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  // Listener perpetuo en el contenedor maestro: al cambiar capítulo el mousemove
  // sigue vivo aunque el video interno reinicie su stream.
  useEffect(() => {
    const target = getFullscreenTarget();
    if (!target || isMobileLike) return;
    const reveal = () => showControlsTemp();
    target.addEventListener("mousemove", reveal);
    return () => target.removeEventListener("mousemove", reveal);
  }, [getFullscreenTarget, isMobileLike, showControlsTemp]);

  const toggleControls = useCallback(() => {
    setShowControls((visible) => {
      const next = !visible;
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      if (next && !showEpList) {
        controlsTimer.current = setTimeout(() => setShowControls(false), HIDE_MS);
      }
      return next;
    });
  }, [HIDE_MS, showEpList]);

  useEffect(() => {
    if (!playing) {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      setShowControls(true);
      return;
    }
    if (showControls) scheduleControlsHide();
  }, [playing, showControls, scheduleControlsHide]);

  // Double-tap seek (±10s): divide el player en izquierda/derecha.
  // El tap simple espera antes de alternar controles para confirmar que no fue doble tap.
  const lastTapRef = useRef<{ time: number; side: "left" | "right" } | null>(null);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seekFlash, setSeekFlash] = useState<null | "back" | "fwd">(null);

  useEffect(() => {
    return () => {
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  const handleContainerTap = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-player-control="true"]')) return;
    // Si el menú de episodios está abierto, un tap fuera solo lo cierra (no togglea controles).
    if (showEpList) {
      setShowEpList(false);
      showControlsTemp();
      return;
    }
    const video = videoRef.current;
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";
    const last = lastTapRef.current;

    // DOBLE TAP — sensor independiente: no muestra/oculta controles, solo salta ±10s.
    if (last && now - last.time <= DOUBLE_TAP_MS && last.side === side && video && video.duration) {
      if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
      const delta = side === "left" ? -10 : 10;
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
      setSeekFlash(null);
      requestAnimationFrame(() => setSeekFlash(side === "left" ? "back" : "fwd"));
      setTimeout(() => setSeekFlash(null), 480);
      lastTapRef.current = { time: now, side };
      return;
    }

    // TAP SIMPLE → toggle controles, con delay corto para no chocar con un 2do tap
    lastTapRef.current = { time: now, side };
    if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
    singleTapTimer.current = setTimeout(() => {
      toggleControls();
      singleTapTimer.current = null;
      lastTapRef.current = null;
    }, SINGLE_TAP_DELAY_MS);
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
      <div ref={containerRef} id="playerVideo" data-player-video="true" className="relative aspect-video bg-black rounded-xl overflow-hidden">
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
      id="playerVideo"
      data-player-video="true"
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
          <Zap className="w-12 h-12 text-muted-foreground/50 fill-current animate-[zet-bolt-pulse_1.8s_ease-in-out_infinite]" />
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

      <video ref={videoRef} className="relative z-[1] w-full h-full object-contain" playsInline muted={muted} crossOrigin="anonymous" />

      {subsActive && activeSubtitleText && (
        <div
          className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${isFullscreen ? "bottom-[16%]" : "bottom-[18%]"}`}
          style={{ zIndex: 5 }}
        >
          <div
            className="max-w-[92%] whitespace-pre-line text-center font-bold leading-snug"
            style={{
              color: "#fff",
              fontSize: "clamp(16px, 2.4vw, 28px)",
              textShadow: "2px 2px 4px #000, 0 0 10px #000, -1px -1px 2px #000",
              padding: "4px 12px",
            }}
          >
            {activeSubtitleText}
          </div>
        </div>
      )}

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

      {/* Controls overlay — usa visibility: hidden cuando está oculto para bloquear TODOS los clicks (incluso en hijos con pointer-events:auto). Esto arregla el bug del APK donde los botones de prev/next se ejecutaban estando ocultos. */}
      <div
        aria-hidden={!(showControls || !playing)}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        {/* Top bar with server picker — nombre se muestra como "Pro" */}
        <div data-player-control="true" className="pointer-events-auto absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between">
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
        {isFullscreen && !loading && !error && (
          <div data-player-control="true" className="pointer-events-auto absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 sm:gap-7">
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
        <div data-player-control="true" className="pointer-events-auto absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
          <div onClick={seekTo} className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/bar">
            <div className="h-full bg-primary rounded-full relative transition-all" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%" }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-primary transition shrink-0">
                {playing ? <Play className="w-5 h-5 fill-current" /> : <Zap className="w-5 h-5 fill-current" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-primary transition shrink-0">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              {effectiveSubtitles.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSubsActive((v) => !v); if (!subsActive) setShowSubtitleMenu(false); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowSubtitleMenu((v) => !v); }}
                    className={`text-white hover:text-primary transition ${subsActive ? "text-primary" : ""}`}
                    aria-label={subsActive ? "Desactivar subtítulos" : "Activar subtítulos"}
                    title={subsActive ? "Subtítulos: ON" : "Subtítulos: OFF"}
                  >
                    {subsActive ? <Captions className="w-5 h-5" /> : <CaptionsOff className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSubtitleMenu((v) => !v); }}
                    className="ml-1 align-top text-[10px] font-bold text-white/80 hover:text-primary transition"
                    aria-label="Elegir idioma de subtítulos"
                    title="Elegir idioma"
                  >
                    {selectedSubtitleUrl ? getSubtitleLanguage(effectiveSubtitles.find((sub) => sub.url === selectedSubtitleUrl) || effectiveSubtitles[0]).code.toUpperCase() : "SUB"}
                  </button>
                  {showSubtitleMenu && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 max-h-48 w-44 overflow-y-auto rounded-md border border-primary/40 bg-background/95 p-1 shadow-[0_0_18px_hsl(var(--primary)/0.35)] backdrop-blur">
                      {subtitleOptions.map(({ sub, index, language }) => (
                        <button
                          key={`${sub.url}-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubtitleUrl(sub.url);
                            setSubsActive(true);
                            setShowSubtitleMenu(false);
                          }}
                          className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${selectedSubtitleUrl === sub.url ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"}`}
                        >
                          {language.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); skip90(); }}
                className="px-2 py-0.5 rounded-md border border-primary/50 text-[10px] font-bold text-white hover:bg-primary/20 hover:text-primary transition flex items-center gap-1 shrink-0"
                aria-label="Saltar 1:30"
                title="Saltar opening/ending (+1:30)"
              >
                <SkipForward className="w-3 h-3" /> +1:30
              </button>
              <span className="text-[10px] text-white/70 tabular-nums shrink-0">
                {formatTime(progress)} / {formatTime(duration)}
              </span>
              {isFullscreen && currentEpisode != null && totalEpisodes && totalEpisodes > 0 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEpList((v) => !v); showControlsTemp(); }}
                    className="px-2 py-0.5 rounded-md border border-primary/50 text-[10px] font-bold text-white hover:bg-primary/20 hover:text-primary transition flex items-center gap-1 shrink-0"
                    aria-label="Lista de episodios"
                    title="Lista de episodios"
                  >
                    <List className="w-3 h-3" /> {currentEpisode}/{totalEpisodes}
                  </button>
                  {showEpList && (
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 min-w-0 flex-1 rounded-md border border-primary/40 bg-black/70 px-1 py-0.5">
                      {!isMobileLike && (
                        <button
                          onClick={(e) => { e.stopPropagation(); epScrollRef.current?.scrollBy({ left: -120, behavior: "smooth" }); }}
                          className="shrink-0 h-5 w-5 rounded bg-white/10 hover:bg-primary/30 text-white flex items-center justify-center"
                          aria-label="Anterior"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                      )}
                      <div ref={epScrollRef} className="flex-1 min-w-0 overflow-x-auto scrollbar-none">
                        <div className="flex w-max gap-1">
                          {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((n) => (
                            <button
                              key={n}
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEpList(false);
                                onSelectEpisode?.(n);
                              }}
                              className={`h-5 min-w-6 rounded px-1.5 text-[10px] font-bold transition ${
                                n === currentEpisode
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary/80 text-foreground hover:bg-primary/40"
                              }`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      {!isMobileLike && (
                        <button
                          onClick={(e) => { e.stopPropagation(); epScrollRef.current?.scrollBy({ left: 120, behavior: "smooth" }); }}
                          className="shrink-0 h-5 w-5 rounded bg-white/10 hover:bg-primary/30 text-white flex items-center justify-center"
                          aria-label="Siguiente"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-primary transition shrink-0">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
