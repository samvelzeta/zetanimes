// Overlay de anuncio VAST (video) sobre el reproductor.
// Reemplaza al banner imagen (AdOverlayGate) manteniendo el mismo comportamiento:
// - Pausa el video principal mientras se muestra el anuncio.
// - Botón "Cerrar en Xs" deshabilitado hasta que termina el contador.
// - Vive dentro del contenedor maestro del player para no romper fullscreen.
//
// Alternancia: 1 sí / 1 no vía localStorage (clave `zet:vast-next-show`).
// Premium queda exento por completo.
//
// El VAST URL de Clickadilla se define en VITE_CLICKADILLA_VAST_URL (env) o
// como fallback en la constante VAST_URL de abajo.
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Pega aquí tu VAST link de Clickadilla (Frequency capping: Ilimitado).
const VAST_URL_FALLBACK = "";

const TOGGLE_KEY = "zet:vast-next-show";
const LAST_EP_KEY = "zet:vast-last-ep";

interface Props {
  episodeKey: string;
  /** Segundos antes de poder cerrar. Default 5. */
  countdownSecs?: number;
  onClosed?: () => void;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`VAST fetch ${res.status}`);
  return res.text();
}

/** Parsea VAST/VAST Wrapper y devuelve la mejor MediaFile URL (mp4/webm). */
async function resolveVastMedia(url: string, depth = 0): Promise<string | null> {
  if (depth > 3) return null;
  const xmlStr = await fetchText(url);
  const doc = new DOMParser().parseFromString(xmlStr, "text/xml");
  const wrapper = doc.querySelector("VASTAdTagURI");
  if (wrapper?.textContent) {
    return resolveVastMedia(wrapper.textContent.trim(), depth + 1);
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
  return scored[0]?.url || null;
}

export default function VastAdOverlay({ episodeKey, countdownSecs = 5, onClosed }: Props) {
  const { isPremium, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [secs, setSecs] = useState(countdownSecs);
  const [muted, setMuted] = useState(true);
  const [loadingAd, setLoadingAd] = useState(false);
  const adVideoRef = useRef<HTMLVideoElement>(null);

  const VAST_URL = (import.meta.env.VITE_CLICKADILLA_VAST_URL as string | undefined) || VAST_URL_FALLBACK;

  // Decide 1 sí / 1 no cuando cambia el episodio.
  useEffect(() => {
    if (loading || isPremium || !episodeKey || !VAST_URL) return;
    const lastEp = localStorage.getItem(LAST_EP_KEY);
    if (lastEp === episodeKey) return; // ya procesado
    localStorage.setItem(LAST_EP_KEY, episodeKey);

    const nextShow = localStorage.getItem(TOGGLE_KEY);
    // Default: mostrar en el primer episodio.
    const shouldShow = nextShow !== "false";
    localStorage.setItem(TOGGLE_KEY, shouldShow ? "false" : "true");

    if (!shouldShow) return;

    setLoadingAd(true);
    setSecs(countdownSecs);
    resolveVastMedia(VAST_URL)
      .then((u) => {
        if (u) {
          setMediaUrl(u);
          setShow(true);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingAd(false));
  }, [episodeKey, isPremium, loading, countdownSecs, VAST_URL]);

  // Pausa el video maestro mientras dure el overlay.
  useEffect(() => {
    const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
    if (!video || !show || isPremium) return;
    const pauseBehind = () => video.pause();
    pauseBehind();
    video.addEventListener("play", pauseBehind);
    return () => video.removeEventListener("play", pauseBehind);
  }, [show, isPremium]);

  // Tick countdown.
  useEffect(() => {
    if (!show || secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [show, secs]);

  // Autoplay del anuncio (muted para pasar políticas de autoplay).
  useEffect(() => {
    if (!show || !mediaUrl) return;
    const v = adVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => undefined);
  }, [show, mediaUrl]);

  const canClose = secs <= 0;

  const handleClose = () => {
    if (!canClose) return;
    setShow(false);
    setMediaUrl(null);
    window.setTimeout(() => {
      const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
      video?.play().catch(() => undefined);
    }, 0);
    onClosed?.();
  };

  const handleAdEnded = () => {
    // Al terminar el anuncio, permitir cerrar aunque queden segundos.
    setSecs(0);
  };

  return (
    <div
      id="zet-vast-overlay"
      aria-hidden={!show || isPremium}
      className="absolute inset-0 z-[60] bg-black flex-col items-center justify-center"
      style={{ display: show && !isPremium && mediaUrl ? "flex" : "none" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute top-2 left-3 text-[10px] uppercase tracking-widest text-white/60 z-10">
        Publicidad — Apoya ZetAnime
      </div>

      {mediaUrl && (
        <video
          ref={adVideoRef}
          src={mediaUrl}
          className="w-full h-full object-contain"
          playsInline
          autoPlay
          muted={muted}
          onEnded={handleAdEnded}
          onError={handleAdEnded}
        />
      )}

      {/* Mute toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          const v = adVideoRef.current;
          const m = !muted;
          setMuted(m);
          if (v) v.muted = m;
        }}
        className="absolute top-2 right-3 w-9 h-9 rounded-full bg-black/60 border border-white/15 flex items-center justify-center text-white/80 hover:text-white z-10"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      {/* Close button */}
      <button
        onClick={handleClose}
        disabled={!canClose}
        className={`absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all z-10 ${
          canClose
            ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
            : "bg-white/10 text-white/60 cursor-not-allowed"
        }`}
      >
        {canClose ? (
          <>
            <X className="w-4 h-4" /> Cerrar anuncio
          </>
        ) : (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cerrar en {secs}s
          </>
        )}
      </button>

      {loadingAd && !mediaUrl && (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      )}
    </div>
  );
}
