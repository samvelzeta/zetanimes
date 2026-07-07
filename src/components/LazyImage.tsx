import { useState } from "react";
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
export default function LazyImage({
  src,
  alt,
  keepWhenOffscreen: _ignored,
  placeholderClassName = "",
  className = "",
  ...rest
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const dataSaver = getStaticPreference("dataSaver");
  const finalSrc = dataSaver ? toLightSrc(src) : src;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <Skeleton bolt className={`absolute inset-0 bg-secondary rounded-none ${placeholderClassName}`} />
      )}
      <img
        src={finalSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        {...rest}
      />
    </div>
  );
}
