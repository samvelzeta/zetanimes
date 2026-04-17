import { useEffect, useState, type RefObject } from "react";

/**
 * Devuelve true cuando el elemento referenciado está visible en el viewport.
 * Útil para pausar animaciones, autoplay y timers cuando el componente no se ve.
 */
export function useInViewport<T extends Element>(
  ref: RefObject<T>,
  rootMargin = "100px"
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin, threshold: 0.01 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
