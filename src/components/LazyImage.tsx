import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

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
 * - Descarga la imagen una sola vez al entrar al viewport (rootMargin 300px).
 * - Una vez cargada, se "hiberna" visualmente (visibility:hidden) cuando sale.
 * - Usa forwardRef para evitar warnings cuando va dentro de botones u otros wrappers.
 */
const LazyImage = forwardRef<HTMLDivElement, Props>(function LazyImage(
  { src, alt, keepWhenOffscreen: _ignored, placeholderClassName = "", className = "", ...rest },
  outerRef
) {
  const innerRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(outerRef, () => innerRef.current as HTMLDivElement);

  const [shouldLoad, setShouldLoad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShouldLoad(true);
            setInView(true);
          } else {
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
    <div ref={innerRef} className={`relative overflow-hidden ${className}`}>
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
          style={{ visibility: inView ? "visible" : "hidden" }}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          {...rest}
        />
      )}
    </div>
  );
});

export default LazyImage;
