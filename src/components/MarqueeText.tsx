import { useEffect, useRef, useState } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Píxeles por segundo. Default 40 (más grande = más rápido). */
  speed?: number;
  title?: string;
}

/**
 * Texto en una sola línea que, si desborda, se desliza continuamente de
 * derecha a izquierda como un carrusel real (loop sin cortes). Al hacer hover
 * o tocar se pausa para poder leer/copiar el título.
 */
export default function MarqueeText({
  text,
  className = "",
  speed = 40,
  title,
}: MarqueeTextProps) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const chunkRef = useRef<HTMLSpanElement>(null);
  const [scrolling, setScrolling] = useState(false);
  const [duration, setDuration] = useState(12);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current;
      const c = chunkRef.current;
      if (!w || !c) return;
      const contentWidth = c.scrollWidth;
      const wrapWidth = w.clientWidth;
      if (contentWidth - wrapWidth > 2) {
        setScrolling(true);
        setDuration(Math.max(6, contentWidth / speed));
      } else {
        setScrolling(false);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (chunkRef.current) ro.observe(chunkRef.current);
    return () => ro.disconnect();
  }, [text, speed]);

  // IntersectionObserver: pausa la animación cuando el título no está en pantalla
  // para liberar CPU/GPU y mantener el scroll fluido (patrón Netflix/Disney+).
  useEffect(() => {
    if (!scrolling) return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrolling]);

  if (!scrolling) {
    return (
      <span
        ref={wrapRef}
        className={`marquee-wrap ${className}`}
        title={title ?? text}
      >
        <span ref={chunkRef} className="marquee-chunk marquee-static">
          {text}
        </span>
      </span>
    );
  }

  return (
    <span
      ref={wrapRef}
      className={`marquee-wrap is-scrolling ${className}`}
      title={title ?? text}
      data-marquee={inView ? "on" : "paused"}
    >
      <span
        className="marquee-track"
        style={{
          animationDuration: `${duration}s`,
          animationPlayState: inView ? "running" : "paused",
          willChange: inView ? "transform" : "auto",
        }}
      >
        <span ref={chunkRef} className="marquee-chunk">{text}</span>
        <span className="marquee-chunk" aria-hidden="true">{text}</span>
      </span>
    </span>
  );
}
