import { useEffect, useRef, useState } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** @deprecated Mantenido por compatibilidad. Ahora la imagen siempre se conserva en memoria una vez descargada. */
  keepWhenOffscreen?: boolean;
  /** Clase para el placeholder */
  placeholderClassName?: string;
}

/**
 * <LazyImage /> optimizado:
 * - Descarga la imagen una sola vez cuando entra al viewport (o cerca: rootMargin 300px)
 * - Una vez cargada, NO se descarga: solo se oculta visualmente (visibility:hidden) cuando sale del viewport
 *   → esto "hiberna" el render sin volver a pedir bytes a la red
 * - Resultado: scroll fluido en celular sin recargas continuas
 */
export default function LazyImage({
  src,
  alt,
  keepWhenOffscreen: _ignored,
  placeholderClassName = "",
  className = "",
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShouldLoad(true);
            setInView(true);
          } else {
            // Hibernar visualmente, pero conservar el <img> en memoria
            setInView(false);
          }
        });
      },
      { rootMargin: "300px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {(!shouldLoad || !loaded) && (
        <div
          className={`absolute inset-0 bg-secondary animate-pulse ${placeholderClassName}`}
        />
      )}
      {shouldLoad && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          // visibility:hidden libera GPU/composición pero mantiene la imagen decodificada
          style={{ visibility: inView ? "visible" : "hidden" }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          {...rest}
        />
      )}
    </div>
  );
}
