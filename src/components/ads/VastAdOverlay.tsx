// Overlay de anuncio VAST (video) sobre el reproductor nativo.
// - Rotación aleatoria + waterfall entre VAST_POOL.
// - Timeout duro para no dejar pantalla negra > pocos segundos.
// - Auto-cierre a los 15s (o al terminar el anuncio).
// - X diminuta arriba-derecha (intencional para favorecer clic al anuncio).
// - Click en el video → abre ClickThrough en pestaña nueva / Chrome externo (APK).
// - Pausa el reproductor maestro mientras dura el anuncio.
// - Premium: exento.
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { openExternalChrome } from "@/lib/apk-intent";

const VAST_POOL: string[] = [
  "https://vast.yomeno.xyz/vast?spot_id=1496604",
  "https://vast.yomeno.xyz/vast?spot_id=1496607",
  "https://vast.yomeno.xyz/vast?spot_id=1496606",
  "https://vast.yomeno.xyz/vast?spot_id=1496608",
  "https://vast.yomeno.xyz/vast?spot_id=1496609",
  "https://vast.yomeno.xyz/vast?spot_id=1496610",
];

const TOGGLE_KEY = "zet:vast-next-show";
const LAST_EP_KEY = "zet:vast-last-ep";
const LAST_SEEN_KEY = "zet:vast-last-seen";
const INACTIVITY_MS = 30 * 60 * 1000;
const VAST_PRIMARY_TIMEOUT_MS = 2500;
const VAST_FALLBACK_TIMEOUT_MS = 2000;
// Cada "segundo" del contador dura un poco más para que el usuario perciba
// la espera completa antes de poder cerrar (15 ticks * 1100ms ≈ 16.5s).
const TICK_MS = 1100;

interface Props {
  episodeKey: string;
  /** Segundos que hay que esperar antes de mostrar la X. Default 15. */
  countdownSecs?: number;
  onClosed?: () => void;
}

interface VastCreative {
  mediaUrl: string;
  clickThrough: string | null;
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { credentials: "omit", signal: ctrl.signal });
    if (!res.ok) throw new Error(`VAST fetch ${res.status}`);
    return await res.text();
  } finally {
    window.clearTimeout(t);
  }
}

async function resolveVastCreative(
  url: string,
  timeoutMs: number,
  depth = 0,
  deadline = Date.now() + timeoutMs,
): Promise<VastCreative | null> {
  if (depth > 3) return null;
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;
  const xmlStr = await fetchTextWithTimeout(url, remaining);
  const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
  const wrapper = doc.querySelector("VASTAdTagURI");
  if (wrapper?.textContent) {
    return resolveVastCreative(wrapper.textContent.trim(), timeoutMs, depth + 1, deadline);
  }
  const files = Array.from(doc.querySelectorAll("MediaFile"));
  const scored = files
    .map((n) => ({
      url: (n.textContent || "").trim(),
      type: n.getAttribute("type") || "",
      w: parseInt(n.getAttribute("width") || "0"),
    }))
    .filter((f) => f.url && /mp4|webm/i.test(f.type));
  scored.sort((a, b) => b.w - a.w);
  const mediaUrl = scored[0]?.url;
  if (!mediaUrl) return null;
  const click = doc.querySelector("ClickThrough")?.textContent?.trim() || null;
  return { mediaUrl, clickThrough: click };
}

async function resolveFromPool(pool: string[]): Promise<VastCreative | null> {
  if (pool.length === 0) return null;
  const first = pool[Math.floor(Math.random() * pool.length)];
  try {
    const c = await resolveVastCreative(first, VAST_PRIMARY_TIMEOUT_MS);
    if (c) return c;
  } catch { /* fallback */ }
  const rest = pool.filter((x) => x !== first);
  if (rest.length === 0) return null;
  const second = rest[Math.floor(Math.random() * rest.length)];
  try {
    return await resolveVastCreative(second, VAST_FALLBACK_TIMEOUT_MS);
  } catch {
    return null;
  }
}

export default function VastAdOverlay({ episodeKey, countdownSecs = 15, onClosed }: Props) {
  const { isPremium, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [creative, setCreative] = useState<VastCreative | null>(null);
  const [muted, setMuted] = useState(true);
  const [loadingAd, setLoadingAd] = useState(false);
  const adVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (loading || isPremium || !episodeKey || VAST_POOL.length === 0) return;
    const lastEp = localStorage.getItem(LAST_EP_KEY);
    if (lastEp === episodeKey) return;
    localStorage.setItem(LAST_EP_KEY, episodeKey);

    const lastSeenRaw = localStorage.getItem(LAST_SEEN_KEY);
    const lastSeen = lastSeenRaw ? parseInt(lastSeenRaw, 10) : 0;
    const now = Date.now();
    const inactive = !lastSeen || now - lastSeen > INACTIVITY_MS;
    localStorage.setItem(LAST_SEEN_KEY, String(now));

    const nextShow = localStorage.getItem(TOGGLE_KEY);
    const shouldShow = inactive || nextShow !== "false";
    localStorage.setItem(TOGGLE_KEY, shouldShow ? "false" : "true");
    if (!shouldShow) return;

    let cancelled = false;
    setLoadingAd(true);
    const bailout = window.setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setLoadingAd(false);
    }, VAST_PRIMARY_TIMEOUT_MS + VAST_FALLBACK_TIMEOUT_MS + 500);

    resolveFromPool(VAST_POOL)
      .then((c) => {
        if (cancelled) return;
        if (c) {
          setCreative(c);
          setShow(true);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(bailout);
        if (!cancelled) setLoadingAd(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(bailout);
    };
  }, [episodeKey, isPremium, loading]);

  // Pausa el video maestro mientras dura el overlay.
  useEffect(() => {
    const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
    if (!video || !show || isPremium) return;
    const pauseBehind = () => video.pause();
    pauseBehind();
    video.addEventListener("play", pauseBehind);
    return () => video.removeEventListener("play", pauseBehind);
  }, [show, isPremium]);

  // Autoplay + auto-close a los 15s.
  useEffect(() => {
    if (!show || !creative) return;
    const v = adVideoRef.current;
    if (v) {
      v.muted = true;
      v.play().catch(() => undefined);
    }
    const closeTimer = window.setTimeout(() => close(), AUTO_CLOSE_MS);
    return () => window.clearTimeout(closeTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, creative]);

  const close = () => {
    setShow(false);
    setCreative(null);
    window.setTimeout(() => {
      const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
      video?.play().catch(() => undefined);
    }, 0);
    onClosed?.();
  };

  const handleAdClick = () => {
    const target = creative?.clickThrough;
    if (!target) return;
    openExternalChrome(target);
  };

  return (
    <div
      id="zet-vast-overlay"
      aria-hidden={!show || isPremium}
      className="absolute inset-0 z-[60] bg-black flex items-center justify-center"
      style={{ display: show && !isPremium && creative ? "flex" : "none" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute top-1.5 left-2 text-[9px] uppercase tracking-widest text-white/50 z-10 pointer-events-none select-none">
        Publicidad
      </div>

      {creative && (
        <video
          ref={adVideoRef}
          src={creative.mediaUrl}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          autoPlay
          muted={muted}
          onClick={handleAdClick}
          onEnded={close}
          onError={close}
        />
      )}

      {/* Mute / unmute */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const v = adVideoRef.current;
          const m = !muted;
          setMuted(m);
          if (v) v.muted = m;
        }}
        className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-white/80 hover:text-white z-10"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      {/* X diminuta arriba a la derecha — intencionalmente pequeña. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
        className="absolute top-1 right-1 w-4 h-4 rounded-sm bg-black/70 hover:bg-black/90 flex items-center justify-center text-white/70 hover:text-white z-20"
        aria-label="Cerrar anuncio"
      >
        <X className="w-2.5 h-2.5" strokeWidth={2.5} />
      </button>

      {loadingAd && !creative && (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      )}
    </div>
  );
}
