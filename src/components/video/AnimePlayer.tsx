import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Pause, Play, Maximize, Minimize, Volume2, VolumeX, Server, Loader2, AlertCircle, SkipBack, SkipForward, Zap, X, List, ChevronLeft, ChevronRight, Captions, CaptionsOff, Gauge, Check, Type, Film } from "lucide-react";
import { isWebView } from "@/lib/webview";
import { resolveStreamEpisode, type SeekeQuality } from "@/lib/zetapi";
import { useSubtitlePrefs, subtitleStyle, subtitlePositionClass } from "@/hooks/useSubtitlePrefs";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { useAuth } from "@/contexts/AuthContext";
import SubtitleSettings from "@/components/premium/SubtitleSettings";

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
  /** Variante (1..N) usada para desambiguar bloques solapados en resolve-stream. */
  variant?: number;
}

const EMPTY_PLAYER_SUBTITLES: PlayerSubtitle[] = [];

interface Props {
  sources: PlayerSource[];
  /** ID de AniList — obligatorio para el flujo Seeke seguro (edge function). */
  anilistId?: number;
  /** Idioma actual — obligatorio para el flujo Seeke seguro. */
  lang?: string;
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
  onSelectEpisode?: (ep: number, variant?: number) => void;
  /** Lista lineal de slots (ep, variant) — cuando hay bloques solapados, un ep puede aparecer 2+ veces. */
  episodeSlots?: Array<{ ep: number; variant: number; blockLabel?: string | null }>;
  currentVariant?: number;
  episodeThumbnails?: string[];
  subtitles?: PlayerSubtitle[];
  fullscreenContainerRef?: React.RefObject<HTMLElement>;
  onControlsVisibilityChange?: (visible: boolean) => void;
  onEpisodeListToggle?: (open: boolean) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
  variant?: number;
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
      classified.push({ type: "html", url, name: s.name, episode: s.episode, variant: s.variant });
    } else if (s.type === "seeke") {
      classified.push({ type: "seeke", url, name: s.name, episode: s.episode, variant: s.variant });
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

function extractEmbedSrc(html: string): string | null {
  if (typeof window === "undefined") return null;
  const documentNode = new DOMParser().parseFromString(html, "text/html");
  const iframeSrc = documentNode.querySelector("iframe")?.getAttribute("src")?.trim();
  return iframeSrc || null;
}

export default function AnimePlayer({ sources, anilistId, lang, title, onProgress, onSeeked, autoplay = true, initialTime, showServerPicker: showServerPickerEnabled = true, episodeKey, canPrev, canNext, onPrev, onNext, onAutoNext, autoNextAlreadyTriggered, currentEpisode, totalEpisodes, onSelectEpisode, episodeSlots, currentVariant = 1, episodeThumbnails, subtitles = EMPTY_PLAYER_SUBTITLES, fullscreenContainerRef, onControlsVisibilityChange, onEpisodeListToggle, onFullscreenChange }: Props) {
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
  const [qualities, setQualities] = useState<SeekeQuality[]>([]);
  const [selectedQualityUrl, setSelectedQualityUrl] = useState<string | null>(null);
  const selectedQualityEpisodeKeyRef = useRef<string | undefined>(episodeKey);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const resumeTimeRef = useRef<number | null>(null);
  const effectiveSubtitles = useMemo(() => subtitles.length > 0 ? subtitles : seekeSubs, [subtitles, seekeSubs]);
  const subsKey = useMemo(() => effectiveSubtitles.map((s) => `${s.lang}|${s.url}`).join("¶"), [effectiveSubtitles]);
  const [selectedSubtitleUrl, setSelectedSubtitleUrl] = useState<string | null>(null);
  const [parsedSubtitleCues, setParsedSubtitleCues] = useState<ParsedSubtitleCue[]>([]);
  const [activeSubtitleText, setActiveSubtitleText] = useState("");
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubPrefs, setShowSubPrefs] = useState(false);
  
  const { permissions, ready: permsReady } = usePlanPermissions();
  const { isOwner, user } = useAuth();
  // Sin cuenta => nunca premium. Con cuenta, solo si el plan resuelto no es free.
  const isPremium = !!user && permsReady && permissions.slug !== "free";
  const { prefs: subPrefs, update: updateSubPrefs, reset: resetSubPrefs } = useSubtitlePrefs(isPremium);

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
  const normalizedEmbedUrl = useMemo(
    () => currentSource?.type === "html" ? extractEmbedSrc(currentSource.url) : currentSource?.url || null,
    [currentSource?.type, currentSource?.url]
  );

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
    const video = videoRef.current;
    if (!video) return;
    if (resumeTimeRef.current != null && resumeTimeRef.current > 0) {
      const t = resumeTimeRef.current;
      resumeTimeRef.current = null;
      try { video.currentTime = t; } catch {}
      return;
    }
    if (hasRestoredTime.current || !initialTime || initialTime <= 0) return;
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
      const requestedEp = currentSource.episode || 1;
      const qualityUrlForCurrentEpisode = selectedQualityEpisodeKeyRef.current === episodeKey ? selectedQualityUrl : null;
      setLoading(true);
      if (qualityUrlForCurrentEpisode == null) {
        setSeekeSubs([]);
        setQualities([]);
      }
      if (import.meta.env.DEV) console.log(`[zetAnimes] Calibrando transmisión · ep ${requestedEp}`);
      if (!anilistId || !lang) {
        setError(true);
        setLoading(false);
        return;
      }
      resolveStreamEpisode(anilistId, lang, requestedEp, currentSource.variant || 1)
        .then((data) => {
          if (cancelled || abort.signal.aborted) return;
          const returnedEp = Number(data.episode);
          if (Number.isFinite(returnedEp) && returnedEp !== requestedEp) {
            if (import.meta.env.DEV) console.warn(`[zetAnimes] desfase de episodio · pedido ${requestedEp} · recibido ${returnedEp}`);
          }
          if (Array.isArray(data.subtitles)) setSeekeSubs(data.subtitles);
          const qs = data.qualities || [];
          setQualities(qs);
          const findQ = (label: string) => qs.find((q) => (q.label || "").toUpperCase() === label)?.url;
          const QRANK: Record<string, number> = { "360P": 0, "540P": 1, "720P": 2, "1080P": 3, "2160P": 4, "4K": 4 };
          const highest = [...qs].sort((a, b) => (QRANK[(b.label || "").toUpperCase()] ?? -1) - (QRANK[(a.label || "").toUpperCase()] ?? -1))[0]?.url;
          const autoUrl = isOwner
            ? (highest || findQ("720P") || findQ("540P") || findQ("360P"))
            : isPremium
              ? (findQ("720P") || findQ("540P") || findQ("360P"))
              : (findQ("540P") || findQ("360P"));
          const embedToUse = (qualityUrlForCurrentEpisode && qs.some((q) => q.url === qualityUrlForCurrentEpisode))
            ? qualityUrlForCurrentEpisode
            : (autoUrl || data.embed);
          if (!qualityUrlForCurrentEpisode && autoUrl) {
            selectedQualityEpisodeKeyRef.current = episodeKey;
            setSelectedQualityUrl(autoUrl);
          }
          attachHls(embedToUse);
        })
        .catch((err) => {
          console.error("[seeke] resolve error", err);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSource?.type, currentSource?.url, currentSource?.episode, episodeKey, autoplay, tryNext, restoreTime, selectedQualityUrl, lang]);

  // Reset quality selection when episode changes
  useEffect(() => {
    selectedQualityEpisodeKeyRef.current = episodeKey;
    setSelectedQualityUrl(null);
    setShowQualityMenu(false);
  }, [episodeKey]);

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

  // Fullscreen: lock landscape on mobile/webview (forzado, ignora bloqueo del sistema)
  useEffect(() => {
    const onFsChange = () => {
      const target = getFullscreenTarget();
      const active = document.fullscreenElement;
      const isFull = !!active && !!target && (active === target || active.contains(target) || target.contains(active));
      setIsFullscreen(isFull);
      onFullscreenChange?.(isFull);
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
        unlock?: () => void;
      };
      const legacy = window.screen as unknown as {
        lockOrientation?: (o: string) => boolean;
        mozLockOrientation?: (o: string) => boolean;
        msLockOrientation?: (o: string) => boolean;
        unlockOrientation?: () => void;
        mozUnlockOrientation?: () => void;
        msUnlockOrientation?: () => void;
      };
      const isMobile = inWebView || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isFull && isMobile) {
        // API moderna
        try { orientation.lock?.("landscape").catch(() => undefined); } catch { void 0; }
        // Fallback legacy (Android WebView antiguo)
        try { (legacy.lockOrientation || legacy.mozLockOrientation || legacy.msLockOrientation)?.call(window.screen, "landscape"); } catch { void 0; }
      } else {
        try { orientation.unlock?.(); } catch { void 0; }
        try { (legacy.unlockOrientation || legacy.mozUnlockOrientation || legacy.msUnlockOrientation)?.call(window.screen); } catch { void 0; }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [inWebView, getFullscreenTarget, onFullscreenChange]);

  // Notificar al padre cambios de visibilidad de controles / panel de episodios
  useEffect(() => {
    onControlsVisibilityChange?.(showControls || !playing);
  }, [showControls, playing, onControlsVisibilityChange]);
  useEffect(() => {
    // Si sale de pantalla completa con el panel abierto, ciérralo (solo se usa en FS)
    if (!isFullscreen && showEpList) setShowEpList(false);
    onEpisodeListToggle?.(showEpList);
  }, [showEpList, isFullscreen, onEpisodeListToggle]);

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
          if (import.meta.env.DEV) console.warn("[zetAnimes] No se pudo cargar el subtítulo");
        }
        return;
      }

      const cues = parseSrt(srtText);
      if (import.meta.env.DEV) console.log(`[zetAnimes] Subtítulo listo · ${cues.length} líneas`);
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
      lock?: (orientation: string) => Promise<void>;
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
    <div className="absolute top-2 left-2 z-20">
      <button onClick={(e) => { e.stopPropagation(); setShowServerPicker(!showServerPicker); }}
        className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs flex items-center gap-1 hover:bg-black/90 transition">
        <Server className="w-3 h-3" /> {currentSource?.name || "Servidor"}
      </button>
      {showServerPicker && (
        <div className="absolute left-0 top-full mt-1 bg-black/90 backdrop-blur rounded-lg p-2 min-w-[160px] z-30 max-h-[200px] overflow-y-auto">
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
        {normalizedEmbedUrl ? (
          <iframe
            src={normalizedEmbedUrl}
            className="absolute inset-0 block w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
            allowFullScreen
            referrerPolicy="no-referrer"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads allow-pointer-lock allow-storage-access-by-user-activation"
            title={title || `Reproductor ${currentSource.name}`}
          />
        ) : currentSource.type === "html" ? (
          <div className="w-full h-full [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:border-0 [&_video]:w-full [&_video]:h-full" dangerouslySetInnerHTML={{ __html: currentSource.url }} />
        ) : null}
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
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-3 bg-black/85 px-6 text-center">
          <AlertCircle className="w-9 h-9 text-destructive" />
          <p className="text-sm font-bold text-foreground">No se pudo reproducir este episodio</p>
          <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
            Por favor <span className="text-primary font-bold">reporta este anime</span> desde el botón de reporte para que <span className="text-primary font-bold">Zani y Zen</span> puedan solucionarlo lo más pronto posible. 🙏
          </p>
          <button onClick={(e) => { e.stopPropagation(); setCurrentIdx(0); setError(false); setLoading(true); }}
            className="mt-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold">
            Reintentar
          </button>
        </div>
      )}

      <video ref={videoRef} className={`relative z-[1] w-full h-full object-contain transition-all duration-500 ${showEpList ? "brightness-50 scale-[0.98]" : ""}`} playsInline muted={muted} crossOrigin="anonymous" />

      {subsActive && activeSubtitleText && (
        <div
          className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${subtitlePositionClass(subPrefs.position, isFullscreen)}`}
          style={{ zIndex: 5 }}
        >
          <div
            className="max-w-[92%] whitespace-pre-line text-center"
            style={subtitleStyle(subPrefs)}
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
        className={`absolute inset-0 z-10 transition-opacity duration-700 ${
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

        {/* Bottom controls — slim HUD */}
        <div data-player-control="true" className="pointer-events-auto absolute bottom-0 left-0 right-0 px-2 min-[380px]:px-3 sm:px-4 pb-2 sm:pb-3 pt-6 bg-gradient-to-t from-black/80 to-transparent">
          <div onClick={seekTo} className="w-full h-[3px] bg-white/15 rounded-full cursor-pointer mb-2 group/bar hover:h-[5px] transition-all">
            <div className="h-full bg-primary rounded-full relative transition-all" style={{ width: duration > 0 ? `${(progress / duration) * 100}%` : "0%", boxShadow: "0 0 8px hsl(var(--primary) / 0.65)" }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
            <div className="flex min-w-0 flex-nowrap items-center gap-1 sm:gap-3 overflow-hidden">
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="flex h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-auto sm:w-auto shrink-0 items-center justify-center text-white hover:text-primary hover:drop-shadow-[0_0_10px_hsl(var(--primary))] transition">
                {playing ? <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Zap className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="flex h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-auto sm:w-auto shrink-0 items-center justify-center text-white/80 hover:text-primary transition">
                {muted ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              {effectiveSubtitles.length > 0 && (
                <div className="relative flex h-6 min-[380px]:h-7 sm:h-auto shrink-0 items-center gap-0.5 overflow-hidden">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSubsActive((v) => !v); if (!subsActive) setShowSubtitleMenu(false); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setShowSubtitleMenu((v) => !v); }}
                    className={`flex h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-auto sm:w-auto shrink-0 items-center justify-center text-white/80 hover:text-primary transition ${subsActive ? "text-primary" : ""}`}
                    aria-label={subsActive ? "Desactivar subtítulos" : "Activar subtítulos"}
                    title={subsActive ? "Subtítulos: ON" : "Subtítulos: OFF"}
                  >
                    {subsActive ? <Captions className="w-4 h-4 sm:w-5 sm:h-5" /> : <CaptionsOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowSubtitleMenu((v) => !v); }}
                    className="hidden min-[380px]:inline-flex max-w-7 overflow-hidden text-[9px] sm:text-[10px] font-mono font-medium text-white/70 hover:text-primary transition"
                    aria-label="Elegir idioma de subtítulos"
                    title="Elegir idioma"
                  >
                    {selectedSubtitleUrl ? getSubtitleLanguage(effectiveSubtitles.find((sub) => sub.url === selectedSubtitleUrl) || effectiveSubtitles[0]).code.toUpperCase() : "SUB"}
                  </button>
                  {showSubtitleMenu && (
                    <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full left-0 mb-2 max-h-48 w-44 overflow-y-auto rounded-lg border border-white/10 bg-black/70 backdrop-blur-xl p-1 shadow-2xl">
                      {subtitleOptions.map(({ sub, index, language }) => (
                        <button
                          key={`${sub.url}-${index}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSubtitleUrl(sub.url);
                            setSubsActive(true);
                            setShowSubtitleMenu(false);
                          }}
                          className={`w-full rounded px-2 py-1.5 text-left text-xs transition ${selectedSubtitleUrl === sub.url ? "bg-primary/20 text-primary" : "text-white/80 hover:bg-white/5"}`}
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
                className="flex h-6 min-[380px]:h-7 sm:h-auto shrink-0 items-center gap-0.5 sm:gap-1 rounded-md border border-white/15 px-1 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-medium text-white/80 hover:border-primary hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)] transition whitespace-nowrap overflow-hidden"
                aria-label="Saltar 1:30"
                title="Saltar opening/ending (+1:30)"
              >
                <SkipForward className="w-3 h-3 shrink-0" />
                <span className="min-[380px]:hidden">90</span>
                <span className="hidden min-[380px]:inline">+1:30</span>
              </button>
              <span className="hidden min-[360px]:inline-block max-w-[48px] min-[430px]:max-w-[92px] truncate text-[9px] sm:text-[11px] font-mono tabular-nums tracking-wider text-white/70 shrink-0 whitespace-nowrap">
                <span className="min-[430px]:hidden">{formatTime(progress)}</span>
                <span className="hidden min-[430px]:inline">{formatTime(progress)} <span className="text-white/30 mx-0.5">/</span> {formatTime(duration)}</span>
              </span>
            </div>
            <div className="flex min-w-0 shrink-0 flex-nowrap items-center justify-end gap-1 sm:gap-3">

              {/* Personalizar subtítulos */}
              <div className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSubPrefs((v) => !v); showControlsTemp(); }}
                  className="flex h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-auto sm:w-auto items-center justify-center text-white/80 hover:text-primary transition"
                  aria-label="Personalizar subtítulos"
                  title="Personalizar subtítulos"
                >
                  <Type className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                {showSubPrefs && (
                  <SubtitleSettings
                    prefs={subPrefs}
                    update={updateSubPrefs}
                    reset={resetSubPrefs}
                    onClose={() => setShowSubPrefs(false)}
                    isPremium={isPremium}
                  />
                )}
              </div>
              {/* Quality selector — Baja / Media / Full HD */}
              {qualities.length > 0 && (() => {
                const QLABEL: Record<string, string> = { "360P": "Baja", "540P": "Media", "720P": "Full HD" };
                const QORDER: Record<string, number> = { "360P": 0, "540P": 1, "720P": 2 };
                const items = qualities
                  .map((q) => {
                    const key = q.label.toUpperCase();
                    return { ...q, name: QLABEL[key] || q.label, order: QORDER[key] ?? 99, isFhd: key === "720P" };
                  })
                  .sort((a, b) => a.order - b.order);
                const activeUrl = selectedQualityUrl;
                return (
                  <div className="relative shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowQualityMenu((v) => !v); showControlsTemp(); }}
                      className="flex h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-auto sm:w-auto items-center justify-center text-white/80 hover:text-primary transition"
                      aria-label="Calidad de video"
                      title="Calidad"
                    >
                      <Film className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    {showQualityMenu && (
                      <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl p-1.5 shadow-2xl">
                        <p className="text-[9px] font-mono uppercase tracking-widest text-white/40 px-2 pt-1 pb-1.5">Calidad</p>
                        {items.map((q) => {
                          const isActive = activeUrl ? activeUrl === q.url : false;
                          const isPremiumLocked = q.isFhd && !isPremium;
                          return (
                            <button
                              key={q.label}
                              disabled={isPremiumLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isPremiumLocked) return;
                                const v = videoRef.current;
                                if (v && !Number.isNaN(v.currentTime)) resumeTimeRef.current = v.currentTime;
                                selectedQualityEpisodeKeyRef.current = episodeKey;
                                setSelectedQualityUrl(q.url);
                                setShowQualityMenu(false);
                              }}
                              className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-[11px] transition ${
                                isPremiumLocked
                                  ? "text-[hsl(24_95%_58%)] cursor-not-allowed hover:bg-[hsl(24_95%_58%/0.08)]"
                                  : isActive
                                    ? "bg-primary/20 text-primary"
                                    : "text-white/70 hover:bg-white/5 hover:text-white"
                              }`}
                              title={isPremiumLocked ? "Disponible solo para Usuario Z (premium)" : undefined}
                            >
                              <span className={q.isFhd ? "font-semibold" : ""}>{q.name}</span>
                              <span className="flex items-center gap-1.5 shrink-0">
                                {q.isFhd && (
                                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[hsl(24_95%_58%/0.15)] text-[hsl(24_95%_58%)] border border-[hsl(24_95%_58%/0.4)]">
                                    Usuario Z
                                  </span>
                                )}
                                {isActive && <Check className="w-3 h-3" />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              {/* Speed gear popover */}
              <div className="relative shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowSpeedMenu((v) => !v); showControlsTemp(); }}
                  className="flex h-6 min-[380px]:h-7 sm:h-auto max-w-10 sm:max-w-none items-center justify-center gap-0.5 sm:gap-1 overflow-hidden text-white/80 hover:text-primary transition"
                  aria-label="Velocidad de reproducción"
                  title="Velocidad"
                >
                  <Gauge className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="hidden min-[430px]:inline text-[10px] font-mono tabular-nums truncate">{playbackRate}x</span>
                </button>
                {showSpeedMenu && (
                  <div onClick={(e) => e.stopPropagation()} className="absolute bottom-full right-0 mb-2 w-32 rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl p-1.5 shadow-2xl">
                    <p className="text-[9px] font-mono uppercase tracking-widest text-white/40 px-2 pt-1 pb-1.5">Velocidad</p>
                    {[0.5, 1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={(e) => { e.stopPropagation(); setPlaybackRate(s); setShowSpeedMenu(false); }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-mono tabular-nums transition ${
                          playbackRate === s ? "bg-primary/20 text-primary" : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span>{s}x</span>
                        {playbackRate === s && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isFullscreen && currentEpisode != null && totalEpisodes && totalEpisodes > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEpList((v) => !v); showControlsTemp(); }}
                  className="flex h-6 min-[380px]:h-7 sm:h-auto max-w-12 sm:max-w-none shrink-0 items-center justify-center gap-0.5 sm:gap-1 overflow-hidden text-white/80 hover:text-primary transition"
                  aria-label="Lista de episodios"
                  title="Lista de episodios (solo en pantalla completa)"
                >
                  <List className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="hidden min-[430px]:inline text-[10px] font-mono tabular-nums truncate">{currentEpisode}/{totalEpisodes}</span>
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="flex h-6 w-6 min-[380px]:h-7 min-[380px]:w-7 sm:h-auto sm:w-auto shrink-0 items-center justify-center text-white/80 hover:text-primary transition" aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}>
                {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Episodes side panel — vidrio esmerilado premium */}
      {currentEpisode != null && totalEpisodes && totalEpisodes > 0 && (
        <>
          <div
            className={`absolute inset-0 z-20 bg-black/40 transition-opacity duration-500 ${showEpList ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            onClick={(e) => { e.stopPropagation(); setShowEpList(false); }}
          />
          <aside
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-0 right-0 h-full w-full max-w-sm bg-black/60 backdrop-blur-xl border-l border-white/10 z-30 flex flex-col transition-transform duration-500 ease-out ${
              showEpList ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <header className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="min-w-0">
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-white/40">Episodios</p>
                <h3 className="text-sm font-light text-white tracking-wide mt-0.5 truncate">{title}</h3>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setShowEpList(false); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </header>
            <div ref={epScrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
              {(episodeSlots && episodeSlots.length > 0
                ? episodeSlots
                : Array.from({ length: totalEpisodes }, (_, i) => ({ ep: i + 1, variant: 1 as number, blockLabel: null }))
              ).map((slot) => {
                const n = slot.ep;
                const v = slot.variant;
                const active = n === currentEpisode && v === currentVariant;
                const thumb = episodeThumbnails?.[n - 1];
                const label = v > 1 ? `Episodio ${n} · Parte ${v}` : `Episodio ${n}`;
                return (
                  <button
                    key={`${n}-${v}`}
                    onClick={(e) => { e.stopPropagation(); setShowEpList(false); onSelectEpisode?.(n, v); }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all ${
                      active
                        ? "bg-primary/15 border border-primary/40"
                        : "border border-transparent hover:bg-white/5 hover:border-white/10"
                    }`}
                  >
                    <div className={`relative w-20 h-12 rounded-md flex-shrink-0 overflow-hidden bg-white/5 ${active ? "ring-1 ring-primary/60" : ""}`}>
                      {thumb ? (
                        <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className={`text-xs font-mono tabular-nums ${active ? "text-primary" : "text-white/50"}`}>
                            {String(n).padStart(2, "0")}
                          </span>
                        </div>
                      )}
                      <span className="absolute top-0.5 left-0.5 px-1 rounded bg-black/70 text-[9px] font-black text-white leading-tight">
                        {String(n).padStart(2, "0")}{v > 1 ? `·${v}` : ""}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-light text-white/90 truncate">
                        {label}
                      </p>
                      <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest mt-0.5">
                        {active ? (playing ? "Reproduciendo" : "Actual") : (slot.blockLabel || "Ver")}
                      </p>
                    </div>
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
