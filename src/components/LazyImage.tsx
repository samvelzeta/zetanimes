import { useEffect, useRef, useState } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** @deprecated Mantenido por compatibilidad. */
  keepWhenOffscreen?: boolean;
  /** Clase para el placeholder */
  placeholderClassName?: string;
}

/**
 * <LazyImage /> optimizado:
 * - Descarga la imagen una sola vez cuando entra al viewport (rootMargin 300px).
 * - Una vez cargada, queda FIJA en el DOM (no se hiberna ni se vuelve a pedir).
 *   Esto evita el "parpadeo" al hacer scroll de vuelta o al regresar a Home.
 */
export default function LazyImage({
  src,
  alt,
  keepWhenOffscreen: _ignored,
  placeholderClassName = "",
  className = "",
  ...rest
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (shouldLoad) return;
    const el = innerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShouldLoad(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: "300px", threshold: 0.01 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={innerRef} className={`relative overflow-hidden ${className}`}>
      {(!shouldLoad || !loaded) && (
        <div className={`absolute inset-0 bg-secondary animate-pulse ${placeholderClassName}`} />
      )}
      {shouldLoad && (
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
      )}
    </div>
  );
}
