import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";

/**
 * Footer oculto con revelación por "pull-up" al final de la página.
 * - Mientras la ruleta ocupa la base, el footer no existe visualmente.
 * - Al llegar al final y seguir intentando scrollear hacia abajo (overscroll),
 *   aparece un indicador circular con flecha; a los 2 s el footer se desliza.
 * - En móvil se coloca por encima del BottomNav (z-[60]) y se le suma padding
 *   para que la nav quede pegada abajo sin taparlo.
 */
export default function PullToRevealFooter() {
  const [unlocked, setUnlocked] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const holdStart = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const atBottomRef = useRef(false);

  useEffect(() => {


    const HOLD_MS = 2000;
    const BOTTOM_THRESHOLD = 4;

    const isAtBottom = () => {
      const doc = document.documentElement;
      return window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_THRESHOLD;
    };

    const tick = () => {
      if (holdStart.current == null) return;
      const elapsed = performance.now() - holdStart.current;
      const p = Math.min(1, elapsed / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        setUnlocked(true);
        holdStart.current = null;
        return;
      }
      rafId.current = requestAnimationFrame(tick);
    };

    const startHold = () => {
      if (holdStart.current != null || unlocked) return;
      holdStart.current = performance.now();
      rafId.current = requestAnimationFrame(tick);
    };

    const cancelHold = () => {
      holdStart.current = null;
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = null;
      setProgress(0);
    };

    const onScroll = () => {
      atBottomRef.current = isAtBottom();
      if (!atBottomRef.current) {
        cancelHold();
        setUnlocked(false);
      }
    };


    const onWheel = (e: WheelEvent) => {
      if (!atBottomRef.current) return;
      if (e.deltaY > 0) startHold();
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!atBottomRef.current) return;
      const dy = touchStartY - e.touches[0].clientY;
      if (dy > 8) startHold();
    };
    const onTouchEnd = () => {
      if (!unlocked) cancelHold();
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [unlocked]);

  // Indicador de "pull" — visible solo mientras el usuario forcejea el scroll
  const showIndicator = !unlocked && progress > 0;
  const circumference = 2 * Math.PI * 18;
  const dash = circumference * (1 - progress);

  return (
    <>
      {/* Pull indicator anclado al fondo del viewport */}
      {showIndicator && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[70] pointer-events-none flex flex-col items-center gap-1"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)" }}
          aria-hidden="true"
        >
          <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
              <circle
                cx="20" cy="20" r="18" fill="none"
                stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={dash}
                style={{ transition: "stroke-dashoffset 80ms linear" }}
              />
            </svg>
            <ArrowUp className="w-5 h-5 text-primary animate-bounce" />
          </div>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Descubre más</span>
        </div>
      )}

      {/* Footer real — oculto hasta que se desbloquea */}
      <div
        className={`relative z-[60] overflow-hidden transition-all duration-500 ease-out ${
          unlocked ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
        // En móvil dejamos espacio abajo para que el BottomNav no lo tape
        style={unlocked ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined}
      >
        <SiteFooter />
        {/* Reserva el alto del BottomNav en móvil para que el footer no quede oculto */}
        <div className="h-16 lg:hidden" aria-hidden="true" />
      </div>
    </>
  );
}
