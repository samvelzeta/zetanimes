import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Espacio reservado mientras no se monta para evitar saltos de layout */
  minHeight?: number | string;
  /** Margen para precarga antes de entrar al viewport */
  rootMargin?: string;
  /** Clase opcional para el placeholder */
  placeholderClassName?: string;
}

/**
 * Monta sus children solo cuando el wrapper entra al viewport.
 * Una vez montado, permanece montado (no se desmonta al hacer scroll lejos)
 * para preservar estado de queries/scroll del usuario.
 */
export default function LazySection({
  children,
  minHeight = 280,
  rootMargin = "600px",
  placeholderClassName = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMounted(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mounted, rootMargin]);

  return (
    <div ref={ref} style={!mounted ? { minHeight } : undefined}>
      {mounted ? children : (
        <div className={`mx-4 my-4 rounded-xl bg-secondary/40 animate-pulse ${placeholderClassName}`} style={{ height: typeof minHeight === "number" ? minHeight - 32 : minHeight }} />
      )}
    </div>
  );
}
