import { useEffect, useRef, useState } from "react";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** Mostrar imagen aunque salga del viewport (default false → libera memoria) */
  keepWhenOffscreen?: boolean;
  /** Clase para el placeholder */
  placeholderClassName?: string;
}

/**
 * <LazyImage /> con IntersectionObserver:
 * - Solo carga cuando entra al viewport
 * - Si sale del viewport, vuelve a placeholder (libera memoria) — a menos que `keepWhenOffscreen`
 * - Optimiza rendimiento en carruseles largos
 */
export default function LazyImage({
  src,
  alt,
  keepWhenOffscreen = false,
  placeholderClassName = "",
  className = "",
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            hasLoadedOnce.current = true;
          } else if (!keepWhenOffscreen && hasLoadedOnce.current) {
            // Liberar memoria cuando sale del viewport
            setVisible(false);
            setLoaded(false);
          }
        });
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [keepWhenOffscreen]);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      {/* Placeholder skeleton siempre visible mientras no esté la imagen */}
      {(!visible || !loaded) && (
        <div
          className={`absolute inset-0 bg-secondary animate-pulse ${placeholderClassName}`}
        />
      )}
      {visible && (
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
