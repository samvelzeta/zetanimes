import { useEffect, useRef, useState, type CSSProperties } from "react";

interface MarqueeTextProps {
  text: string;
  className?: string;
  /** Segundos por ciclo completo (más grande = más lento). Default 8s. */
  speed?: number;
  /** Pausa entre ciclos en el borde. Default 1.2s. */
  pauseAtEdges?: number;
  as?: keyof JSX.IntrinsicElements;
  title?: string;
}

/**
 * Texto en una sola línea que, si desborda, se anima suavemente:
 *   – Se desvanece hacia la izquierda y reaparece por la derecha revelando
 *     lo que faltaba. Mientras se hace hover / se toca, se detiene para
 *     poder leer o copiar el nombre completo.
 *   – Si NO desborda, se comporta como texto normal (sin animación).
 */
export default function MarqueeText({
  text,
  className = "",
  speed = 8,
  pauseAtEdges = 1.2,
  as: Tag = "span",
  title,
}: MarqueeTextProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);

  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current;
      const i = innerRef.current;
      if (!w || !i) return;
      const diff = i.scrollWidth - w.clientWidth;
      setOverflow(diff > 2 ? diff : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [text]);

  const animating = overflow > 0;
  const totalDuration = speed + pauseAtEdges * 2;

  const style: CSSProperties = animating
    ? {
        // El shift negativo se calcula con la magnitud del desbordamiento.
        // Usamos animación en el inner + máscara de degradado en el wrap
        // para que los bordes se desvanezcan de forma sutil.
        ["--mq-shift" as any]: `-${overflow}px`,
        ["--mq-duration" as any]: `${totalDuration}s`,
        animationDuration: `${totalDuration}s`,
      }
    : {};

  return (
    <Tag
      // @ts-expect-error – dynamic tag
      ref={wrapRef}
      className={`marquee-wrap ${animating ? "is-animating" : ""} ${className}`}
      title={title ?? text}
      data-marquee={animating ? "on" : "off"}
    >
      <span ref={innerRef} className="marquee-inner" style={style}>
        {text}
      </span>
    </Tag>
  );
}
