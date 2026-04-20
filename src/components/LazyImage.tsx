import { useState } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** @deprecated mantenido por compatibilidad. */
  keepWhenOffscreen?: boolean;
  placeholderClassName?: string;
}

/**
 * <LazyImage /> simplificado:
 * - Carga la imagen de inmediato con `loading="lazy"` nativo del navegador.
 * - No usa IntersectionObserver (consumía CPU al hacer scroll y descargaba
 *   imágenes que volvían a entrar al viewport, causando re-pinturas).
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

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && (
        <div className={`absolute inset-0 bg-secondary animate-pulse ${placeholderClassName}`} />
      )}
      <img
        src={src}
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
