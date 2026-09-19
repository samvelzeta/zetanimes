import { useEffect, useRef, useState, forwardRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getStaticPreference } from "@/contexts/PreferencesContext";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** @deprecated mantenido por compatibilidad. */
  keepWhenOffscreen?: boolean;
  placeholderClassName?: string;
}

/**
 * Cuando el usuario activa "Modo Ahorro de Datos" (preferencia global),
 * degradamos on-the-fly las imágenes de AniList a variantes más ligeras.
 */
function toLightSrc(src: string): string {
  if (!src || !src.includes("anilistcdn")) return src;
  // Solo degradamos si es extraLarge/large. Evitamos tocar medium si ya lo es.
  return src
    .replace("/extraLarge/", "/large/")
    .replace("/large/", "/medium/")
    .replace(/(\/w_)\d+(\/)/g, "240");
}

const MAX_RETRIES = 3;

/**
 * <LazyImage /> auditado:
 * - Soporta forwardRef para evitar warnings en layouts complejos.
 * - Carga la imagen de inmediato con loading="lazy" nativo.
 * - Respeta "Modo Ahorro de Datos" degradando calidad.
 * - Reintentos con cache-buster ante errores 429/5xx de AniList.
 * - Fallback a MyAnimeList si AniList falla definitivamente.
 */
const LazyImage = forwardRef<HTMLImageElement, Props>(({
  src,
  alt,
  keepWhenOffscreen: _ignored,
  placeholderClassName = "",
  className = "",
  ...rest
}, ref) => {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [malSrc, setMalSrc] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const innerRef = useRef<HTMLImageElement>(null);
  const dataSaver = getStaticPreference("dataSaver");

  const baseSrc = attempt === 0 && dataSaver ? toLightSrc(src) : src;
  const retrySrc = attempt > 0 && baseSrc ? `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}r=${attempt}` : baseSrc;
  const finalSrc = malSrc || retrySrc || "/placeholder.svg";

  // Reset cuando cambia la imagen base
  useEffect(() => {
    setLoaded(false);
    setAttempt(0);
    setFailed(false);
    setMalSrc(null);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [src]);

  // Manejo de caché: si al montar la imagen ya está cargada, disparar onLoad
  useEffect(() => {
    if (innerRef.current?.complete && !loaded) {
      setLoaded(true);
      setFailed(false);
    }
  }, [finalSrc]);

  const handleError = () => {
    if (malSrc) {
      setFailed(true);
      setLoaded(true);
      return;
    }
    if (attempt >= MAX_RETRIES) {
      import("@/lib/mal-fallback")
        .then((m) => m.malImageFromAniListUrl(src))
        .then((url) => {
          if (url) {
            setMalSrc(url);
          } else {
            setFailed(true);
            setLoaded(true);
          }
        })
        .catch(() => {
          setFailed(true);
          setLoaded(true);
        });
      return;
    }
    const delay = 400 * Math.pow(2, attempt);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAttempt((a) => a + 1), delay);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <Skeleton bolt className={`absolute inset-0 bg-secondary rounded-none ${placeholderClassName}`} />
      )}
      {failed && !malSrc && (
        <div className="absolute inset-0 bg-secondary flex items-center justify-center" aria-hidden>
           <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
        </div>
      )}
      <img
        ref={(node) => {
          innerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        key={malSrc ?? attempt}
        src={finalSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => { setLoaded(true); setFailed(false); }}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded && !failed ? "opacity-100" : "opacity-0"
        }`}
        {...rest}
      />
    </div>
  );
});

LazyImage.displayName = "LazyImage";

export default LazyImage;
