// Overlay de anuncio VAST (video) sobre el reproductor nativo.
// - Waterfall de 2 niveles: PRIMARY_VAST_URL → FALLBACK_VAST_URL (nunca en paralelo).
// - Timeout de 3s por nivel; si ambos fallan, el anime reproduce normal.
// - Auto-cierre a los 15s (o al terminar el anuncio).
// - X diminuta arriba-derecha (intencional para favorecer clic al anuncio).
// - Click en el video → abre ClickThrough en pestaña nueva / Chrome externo (APK).
// - Pausa el reproductor maestro mientras dura el anuncio.
// - Premium: exento.
import { useEffect, useRef, useState } from "react";
import { X, Loader2, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { openExternalChrome } from "@/lib/apk-intent";
import { getAdsConfig } from "@/config/ads";

const VAST_POOL: string[] = getAdsConfig().vastPool;

const TOGGLE_KEY = "zet:vast-next-show";
const LAST_EP_KEY = "zet:vast-last-ep";
// Waterfall de 2 niveles: PRIMARY (3s) → FALLBACK (3s). Nunca en paralelo,
// para no saturar la red ni invalidar impresiones (fill rate $0).
const VAST_STEP_TIMEOUT_MS = 3000;
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
  /** Píxeles <Impression> de toda la cadena (wrappers incluidos). */
  impressions: string[];
  /** <Tracking event="..."> agrupados por evento. */
  tracking: Record<string, string[]>;
  /** <ClickTracking> de toda la cadena. */
  clickTracking: string[];
}

/** Dispara un pixel de tracking sin bloquear ni romper por CORS. */
function firePixel(url: string) {
  if (!url || !/^https?:\/\//i.test(url)) return;
  try {
    const img = new Image();
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.src = url.replace(/\[CACHEBUSTING\]|%%CACHEBUSTER%%/gi, String(Date.now()));
  } catch {
    try { fetch(url, { mode: "no-cors", credentials: "omit", keepalive: true }); } catch { /* noop */ }
  }
}

function firePixels(urls: string[] | undefined) {
  (urls || []).forEach(firePixel);
}

function collectNodes(doc: Document, sel: string): string[] {
  return Array.from(doc.querySelectorAll(sel))
    .map((n) => (n.textContent || "").trim())
    .filter(Boolean);
}

function collectTracking(doc: Document): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  Array.from(doc.querySelectorAll("TrackingEvents > Tracking")).forEach((n) => {
    const ev = (n.getAttribute("event") || "").trim();
    const url = (n.textContent || "").trim();
    if (!ev || !url) return;
    (out[ev] ||= []).push(url);
  });
  return out;
}

function mergeTracking(a: Record<string, string[]>, b: Record<string, string[]>) {
  const out: Record<string, string[]> = { ...a };
  Object.entries(b).forEach(([k, v]) => { out[k] = [...(out[k] || []), ...v]; });
  return out;
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

// --- Filtro de anuncios para adultos -------------------------------------
// VAST no obliga a declarar categoría, así que combinamos 3 señales:
// 1) <Category> IAB (IAB25-3 = adult content), 2) dominios conocidos,
// 3) palabras clave en título/descripción/URLs.
const ADULT_IAB = /IAB25-3|IAB26|adult|mature/i;
const ADULT_DOMAINS = /(pornhub|xvideos|xnxx|xhamster|redtube|youporn|brazzers|stripchat|chaturbate|bongacams|livejasmin|camsoda|myfreecams|onlyfans|adultfriendfinder|juicyads|exoclick|trafficjunky|eroadvertising|plugrush|tsyndicate|hentai|nutaku|sexlikereal|adsforsex|clickadu\.com\/adult)/i;
const ADULT_WORDS = /(porn|xxx|sex\b|sexo\b|hentai|milf|escort|camgirl|webcam\s?sex|desnud|erotic|erótic|nude|naked|fuck|anal\b|boobs|tetas|putas?|prostit|dating\s?18|adult\s?dating|18\+|nsfw)/i;

function isAdultVast(doc: Document, mediaUrl: string, click: string | null): boolean {
  const cats = Array.from(doc.querySelectorAll("Category, AdCategory"))
    .map((n) => `${n.textContent || ""} ${n.getAttribute("authority") || ""}`)
    .join(" ");
  if (cats && ADULT_IAB.test(cats)) return true;

  const text = [
    doc.querySelector("AdTitle")?.textContent || "",
    doc.querySelector("Description")?.textContent || "",
    doc.querySelector("Advertiser")?.textContent || "",
    mediaUrl,
    click || "",
  ].join(" ");

  return ADULT_DOMAINS.test(text) || ADULT_WORDS.test(text);
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
  // Los wrappers también traen Impression/Tracking/ClickTracking: hay que
  // conservarlos y dispararlos, si no la red no cuenta la impresión.
  const levelImpressions = collectNodes(doc, "Impression");
  const levelTracking = collectTracking(doc);
  const levelClicks = collectNodes(doc, "ClickTracking");

  const wrapper = doc.querySelector("VASTAdTagURI");
  if (wrapper?.textContent) {
    const inner = await resolveVastCreative(wrapper.textContent.trim(), timeoutMs, depth + 1, deadline);
    if (!inner) return null;
    return {
      ...inner,
      impressions: [...levelImpressions, ...inner.impressions],
      tracking: mergeTracking(levelTracking, inner.tracking),
      clickTracking: [...levelClicks, ...inner.clickTracking],
    };
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
  // Descartamos creatividades para adultos: no se muestran ni se trackean.
  if (isAdultVast(doc, mediaUrl, click)) return null;
  return {

    mediaUrl,
    clickThrough: click,
    impressions: levelImpressions,
    tracking: levelTracking,
    clickTracking: levelClicks,
  };
}

// Waterfall estricto y secuencial sobre TODA la lista `vastPool`:
// se prueba el 1º; si no devuelve creativo (XML vacío, error, timeout o
// contenido filtrado), se pasa al 2º, luego al 3º… Nunca en paralelo.
// Puedes añadir o quitar URLs en public/ads.config.js sin tocar el código.
// Si ninguna responde, el anime se reproduce normal, sin errores.
async function resolveFromPool(pool: string[]): Promise<VastCreative | null> {
  const urls = Array.from(new Set((pool || []).map((u) => String(u).trim()).filter(Boolean)));
  if (!urls.length) return null;

  for (const url of urls) {
    try {
      const c = await resolveVastCreative(url, VAST_STEP_TIMEOUT_MS);
      if (c) return c;
    } catch { /* este spot no sirvió: seguimos con el siguiente */ }
  }

  return null;
}

export default function VastAdOverlay({ episodeKey, countdownSecs = 15, onClosed }: Props) {
  const { isPremium, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [creative, setCreative] = useState<VastCreative | null>(null);
  const [muted, setMuted] = useState(true);
  const [loadingAd, setLoadingAd] = useState(false);
  const [secs, setSecs] = useState(countdownSecs);
  const adVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (loading || isPremium || !episodeKey || VAST_POOL.length === 0) return;
    // NOTA: no marcamos "ya visto" aquí. Solo se marca cuando el usuario cierra
    // con la X, para que recargar la página NO permita saltarse el anuncio.
    const lastEp = localStorage.getItem(LAST_EP_KEY);
    if (lastEp === episodeKey) return;

    // Alternancia estricta: un capítulo con anuncio, el siguiente sin anuncio,
    // y así sucesivamente con todos los animes (1 sí, 1 no, 1 sí...).
    const nextShow = localStorage.getItem(TOGGLE_KEY);
    if (nextShow === "false") {
      // Turno "sin anuncio": consumimos el toggle y marcamos episodio como visto
      // para no volver a evaluar en este mismo ep.
      localStorage.setItem(TOGGLE_KEY, "true");
      localStorage.setItem(LAST_EP_KEY, episodeKey);
      return;
    }

    let cancelled = false;
    setLoadingAd(true);
    setSecs(countdownSecs);
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
        } else {
          // No hubo creativo servible: no bloqueamos al usuario, marcamos ep.
          localStorage.setItem(LAST_EP_KEY, episodeKey);
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
  }, [episodeKey, isPremium, loading, countdownSecs]);

  // Pausa el video maestro mientras dura el overlay.
  useEffect(() => {
    const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
    if (!video || !show || isPremium) return;
    const pauseBehind = () => video.pause();
    pauseBehind();
    video.addEventListener("play", pauseBehind);
    return () => video.removeEventListener("play", pauseBehind);
  }, [show, isPremium]);

  // Autoplay + tracking VAST (impresión, quartiles, complete).
  useEffect(() => {
    if (!show || !creative) return;
    const v = adVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => undefined);

    // Impresión: se cuenta al mostrar el creativo.
    firePixels(creative.impressions);
    firePixels(creative.tracking.creativeView);

    const fired = new Set<string>();
    const once = (ev: string) => {
      if (fired.has(ev)) return;
      fired.add(ev);
      firePixels(creative.tracking[ev]);
    };

    const onPlay = () => once("start");
    const onTime = () => {
      const d = v.duration;
      if (!d || !isFinite(d)) return;
      const p = v.currentTime / d;
      if (p >= 0.25) once("firstQuartile");
      if (p >= 0.5) once("midpoint");
      if (p >= 0.75) once("thirdQuartile");
      if (p >= 0.98) once("complete");
    };
    const onEnded = () => { once("complete"); };
    const onVolume = () => firePixels(creative.tracking[v.muted ? "mute" : "unmute"]);

    v.addEventListener("playing", onPlay);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("ended", onEnded);
    v.addEventListener("volumechange", onVolume);
    return () => {
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("volumechange", onVolume);
    };
  }, [show, creative]);

  // Contador lento: 1 tick cada TICK_MS. Cuando llega a 0 aparece la X.
  useEffect(() => {
    if (!show || secs <= 0) return;
    const t = window.setTimeout(() => setSecs((s) => s - 1), TICK_MS);
    return () => window.clearTimeout(t);
  }, [show, secs]);

  const canClose = secs <= 0;

  const close = () => {
    if (!canClose) return;
    firePixels(creative?.tracking.close);
    firePixels(creative?.tracking.closeLinear);
    // Recién ahora marcamos episodio como visto y alternamos toggle.
    localStorage.setItem(LAST_EP_KEY, episodeKey);
    localStorage.setItem(TOGGLE_KEY, "false");
    setShow(false);
    setCreative(null);
    window.setTimeout(() => {
      const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
      video?.play().catch(() => undefined);
    }, 0);
    onClosed?.();
  };

  const handleAdClick = () => {
    if (!creative) return;
    // Los ClickTracking deben dispararse siempre, aunque no haya ClickThrough.
    firePixels(creative.clickTracking);
    const target = creative.clickThrough;
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

      {/* Esquina superior derecha: contador mientras corre, X diminuta al terminar. */}
      {canClose ? (
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
      ) : (
        <div
          className="absolute top-1 right-1 min-w-[20px] h-5 px-1 rounded-sm bg-black/70 text-white/80 text-[10px] font-semibold flex items-center justify-center z-20 select-none pointer-events-none"
          aria-label={`Puedes cerrar en ${secs}s`}
        >
          {secs}s
        </div>
      )}

      {loadingAd && !creative && (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      )}
    </div>
  );
}
