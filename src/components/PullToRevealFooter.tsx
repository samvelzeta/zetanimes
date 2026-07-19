import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";

/**
 * Footer oculto con revelación por "pull-up" al final de la página.
 * - El 1er gesto de scroll hacia abajo al llegar al fondo sólo "arma".
 * - El 2do gesto forzado inicia el hold de 2 s que revela el footer.
 * - El footer se oculta sólo cuando el usuario vuelve a subir activamente.
 */
export default function PullToRevealFooter() {
  const [unlocked, setUnlocked] = useState(false);
  const [progress, setProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);
  const atBottomRef = useRef(false);
  const gestureCountRef = useRef(0);
  const gestureActiveRef = useRef(false);
  const gestureEndTimer = useRef<number | null>(null);

  useEffect(() => {
    const HOLD_MS = 2000;
    const BOTTOM_THRESHOLD = 4;
    const GESTURE_GAP_MS = 220;

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

    const resetGestures = () => {
      gestureCountRef.current = 0;
      gestureActiveRef.current = false;
      if (gestureEndTimer.current) {
        window.clearTimeout(gestureEndTimer.current);
        gestureEndTimer.current = null;
      }
    };

    /** Registra un gesto discreto "hacia abajo" cuando ya estamos en el fondo. */
    const registerDownIntent = () => {
      if (unlocked) return;
      // Recalcula por si el layout creció (ej. resultado de la ruleta añadió alto)
      atBottomRef.current = isAtBottom();
      if (!atBottomRef.current) return;
      if (!gestureActiveRef.current) {
        gestureActiveRef.current = true;
        gestureCountRef.current += 1;
        if (gestureCountRef.current >= 2) startHold();
      }
      if (gestureEndTimer.current) window.clearTimeout(gestureEndTimer.current);
      gestureEndTimer.current = window.setTimeout(() => {
        gestureActiveRef.current = false;
        // No cancelamos el hold aquí: si ya arrancó, lo dejamos correr hasta los 2 s.
      }, GESTURE_GAP_MS);
    };


    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const goingUp = y < lastY - 2;
      lastY = y;
      const wasAtBottom = atBottomRef.current;
      atBottomRef.current = isAtBottom();
      if (!atBottomRef.current) {
        cancelHold();
        if (wasAtBottom) resetGestures();
        if (goingUp) setUnlocked(false);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 0) registerDownIntent();
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      const dy = touchStartY - e.touches[0].clientY;
      if (dy > 8) registerDownIntent();
    };
    const onTouchEnd = () => {
      gestureActiveRef.current = false;
      if (gestureEndTimer.current) window.clearTimeout(gestureEndTimer.current);
      if (holdStart.current != null) cancelHold();
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
      if (gestureEndTimer.current) window.clearTimeout(gestureEndTimer.current);
    };
  }, [unlocked]);

  const showIndicator = !unlocked && progress > 0;
  const circumference = 2 * Math.PI * 18;
  const dash = circumference * (1 - progress);

  return (
    <>
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

      <div
        className={`relative z-[60] overflow-hidden transition-all duration-500 ease-out ${
          unlocked ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
        style={unlocked ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined}
      >
        <SiteFooter />
        <div className="h-16 lg:hidden" aria-hidden="true" />
      </div>
    </>
  );
}
