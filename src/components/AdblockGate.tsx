// Bloquea el uso de la app si detecta un adblock activo en usuarios free.
// Endurecido contra scripts de consola que intentan borrar el overlay:
//  - No usa la clase z-[2147483647] literal (firma pública del hack).
//  - Aplica bloqueo a nivel <html> (clase `zet-blocked`) que desactiva
//    pointer-events y hace blur al #root, así aunque se borre el nodo del
//    modal la app queda inutilizable hasta que se resuelva.
//  - MutationObserver revive el nodo si algo intenta removerlo.
//  - Un keyframe de "resurrección" fuerza re-render cada 800ms mientras
//    esté bloqueado, contrarrestando también scripts que corran en loop.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, RefreshCw, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { detectAdblock } from "@/lib/adblock-detect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isTV } from "@/hooks/useIsTV";

// Nombre de clase impredecible para evitar selectores estáticos del hack.
const GATE_ID = "zet-guard-" + Math.random().toString(36).slice(2, 9);

export default function AdblockGate() {
  const { isPremium, loading, user } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tick, setTick] = useState(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const tvMode = typeof window !== "undefined" && isTV();

  const runCheck = async () => {
    setChecking(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const isBlocking = await detectAdblock();
      setBlocked(isBlocking);
      if (!isBlocking) toast.success("¡Anuncios desbloqueados! Gracias 🧡");
      else toast.error("Aún detectamos el bloqueador. Intenta de nuevo.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (loading || isPremium || tvMode) {
      setBlocked(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const isBlocking = await detectAdblock();
      if (!cancelled) setBlocked(isBlocking);
    };
    const initial = window.setTimeout(check, 1500);
    const interval = window.setInterval(check, 8000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [loading, isPremium, tvMode]);

  // Lock a nivel <html>: aunque borren el modal, la app queda blureada
  // e inaccesible. Se retira sólo cuando pasa la verificación.
  useEffect(() => {
    const html = document.documentElement;
    if (blocked && !isPremium && !tvMode) {
      html.classList.add("zet-blocked");
      document.body.style.overflow = "hidden";
    } else {
      html.classList.remove("zet-blocked");
      document.body.style.overflow = "";
    }
    return () => {
      html.classList.remove("zet-blocked");
      document.body.style.overflow = "";
    };
  }, [blocked, isPremium, tvMode]);

  // MutationObserver: si algo intenta remover el nodo, forzamos re-render.
  useEffect(() => {
    if (!blocked) return;
    const obs = new MutationObserver(() => {
      if (!nodeRef.current || !document.body.contains(nodeRef.current)) {
        setTick((t) => t + 1);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    // Watchdog: revive periódicamente por si el script corre en bucle.
    const iv = window.setInterval(() => {
      if (!nodeRef.current || !document.body.contains(nodeRef.current)) {
        setTick((t) => t + 1);
      }
    }, 800);
    return () => {
      obs.disconnect();
      clearInterval(iv);
    };
  }, [blocked]);

  const goPremium = () => {
    if (!user) {
      toast.info("Primero crea tu cuenta para activar Premium");
      navigate("/auth?redirect=/profile?premium=1");
      return;
    }
    navigate("/profile?premium=1");
  };

  if (isPremium || tvMode || !blocked) return null;

  // z-index alto pero NO el literal 2147483647 (firma del hack).
  const z = 2147480000 + (tick % 1000);

  return (
    <div
      key={tick}
      ref={nodeRef}
      id={GATE_ID}
      data-zet-guard="1"
      className="fixed left-0 top-0 w-screen h-screen bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
      style={{ zIndex: z, pointerEvents: "auto" }}
    >
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-2xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Bloqueador de anuncios detectado
        </h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          ZetAnime es <span className="text-primary font-semibold">100% gratis</span> gracias a los anuncios.
          Por favor, <span className="font-semibold text-foreground">desactiva tu adblock</span> para continuar
          o hazte <span className="font-semibold text-primary">Premium</span> y disfruta sin anuncios.
        </p>
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={runCheck} disabled={checking} className="w-full" size="lg">
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Comprobando…" : "Ya lo desactivé, reintentar"}
          </Button>
          <Button
            type="button"
            onClick={goPremium}
            variant="outline"
            className="w-full border-primary/40 text-primary"
            size="lg"
          >
            <Crown className="w-4 h-4 mr-2" />
            Hazte Premium (sin anuncios)
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-4">
          Tu apoyo paga los servidores y permite agregar más capítulos. ¡Gracias! 🧡
        </p>
      </div>
    </div>
  );
}
