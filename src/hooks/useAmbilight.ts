import { useEffect, useRef } from "react";

/**
 * Ambilight — extrae el color dominante del <video> y lo aplica como
 * box-shadow difuminado gigante alrededor del contenedor.
 * Muestrea ~2fps para no penalizar rendimiento; se detiene si el video
 * está pausado, oculto o el toggle está apagado.
 */
export function useAmbilight(
  videoRef: React.RefObject<HTMLVideoElement>,
  targetRef: React.RefObject<HTMLElement>,
  active: boolean,
) {
  const rafRef = useRef<number | null>(null);
  const lastSample = useRef(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;
    if (!active) {
      target.style.boxShadow = "";
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 9;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const loop = (ts: number) => {
      const v = videoRef.current;
      if (!v || v.paused || v.ended || v.readyState < 2 || document.hidden) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      // throttle a ~2fps
      if (ts - lastSample.current > 480) {
        lastSample.current = ts;
        try {
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          // Amplifica saturación para que se sienta el color
          const max = Math.max(r, g, b);
          if (max < 40) { r = 40; g = 40; b = 60; }
          target.style.boxShadow = [
            `0 0 60px 20px rgba(${r},${g},${b},0.55)`,
            `0 0 140px 40px rgba(${r},${g},${b},0.35)`,
            `0 0 260px 80px rgba(${r},${g},${b},0.20)`,
          ].join(", ");
          target.style.transition = "box-shadow 0.6s ease-out";
        } catch {
          // CORS puede tumbar getImageData en algunas fuentes; abortamos silenciosamente
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      target.style.boxShadow = "";
      target.style.transition = "";
    };
  }, [active, videoRef, targetRef]);
}
