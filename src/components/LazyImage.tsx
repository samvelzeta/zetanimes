import { useEffect, useRef, useState } from "react";
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
  if (!src) return src;
  return src
    .replace("/original/", "/large/")
    .replace("/large/", "/medium/")
    // Cloudinary/Cloudflare width params comunes (por si se usan en R2/CDN)
    .replace(/(\/w_)\d+(\/)/g, "$1240$2");
}

/**
 * <LazyImage /> simplificado:
 * - Carga la imagen de inmediato con `loading="lazy"` nativo del navegador.
 * - Respeta la preferencia global "Modo Ahorro de Datos" degradando la calidad.
 * - Una vez cargada queda fija en el DOM.
 */
const MAX_RETRIES = 3;

export default function LazyImage({
  src,
  alt,
  keepWhenOffscreen: _ignored,
  placeholderClassName = "",
  className = "",
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dataSaver = getStaticPreference("dataSaver");

  // Reset cuando cambia la imagen
  useEffect(() => {
    setLoaded(false);
    setAttempt(0);
    setFailed(false);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [src]);

  // Intento 0: variante normal. Intento 1+: URL original (por si el downgrade
  // de "modo ahorro" apunta a un tamaño inexistente) + cache-buster, porque el
  // CDN de AniList devuelve 429/5xx de forma intermitente.
  const baseSrc = attempt === 0 && dataSaver ? toLightSrc(src) : src;
  const finalSrc = attempt > 0 && baseSrc ? `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}r=${attempt}` : baseSrc;

  const handleError = () => {
    if (attempt >= MAX_RETRIES) {
      setFailed(true);
      setLoaded(true); // evita skeleton infinito
      return;
    }
    const delay = 400 * Math.pow(2, attempt); // 400ms, 800ms, 1.6s
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAttempt((a) => a + 1), delay);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <Skeleton bolt className={`absolute inset-0 bg-secondary rounded-none ${placeholderClassName}`} />
      )}
      {failed && <div className="absolute inset-0 bg-secondary" aria-hidden />}
      <img
        key={attempt}
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
}

