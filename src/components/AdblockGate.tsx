// Modo insistencia (Opción A): NO bloqueamos la app entera para evitar falsos
// positivos con Brave/Firefox estricto, DNS filtrados, redes corporativas, etc.
// En su lugar mostramos un modal cerrable que:
//  - Reaparece cada REMIND_MS (5 min) mientras siga detectado el adblock.
//  - Sobrevive a scripts de consola que intenten borrar el nodo (MutationObserver
//    + id aleatorio + z-index no literal 2147483647).
//  - Permite "Continuar de todas formas" para no perder al usuario.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, RefreshCw, Crown, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { detectAdblock } from "@/lib/adblock-detect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isTV } from "@/hooks/useIsTV";

const GATE_ID = "zet-guard-" + Math.random().toString(36).slice(2, 9);
const REMIND_MS = 5 * 60 * 1000; // 5 min
const SNOOZE_KEY = "zet:adblock-snooze-until";

export default function AdblockGate() {
  const { isPremium, loading, user } = useAuth();
  const navigate = useNavigate();
  const [adblockActive, setAdblockActive] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number>(() => {
    try { return Number(localStorage.getItem(SNOOZE_KEY) || 0); } catch { return 0; }
  });
  const [checking, setChecking] = useState(false);
  const [tick, setTick] = useState(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const tvMode = typeof window !== "undefined" && isTV();

  const now = Date.now();
  const visible = adblockActive && !isPremium && !tvMode && now >= dismissedUntil;

  const runCheck = async () => {
    setChecking(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const isBlocking = await detectAdblock();
      setAdblockActive(isBlocking);
      if (!isBlocking) {
        toast.success("¡Anuncios desbloqueados! Gracias 🧡");
        try { localStorage.removeItem(SNOOZE_KEY); } catch { /* noop */ }
        setDismissedUntil(0);
      } else {
        toast.error("Aún detectamos el bloqueador. Intenta de nuevo.");
      }
    } finally {
      setChecking(false);
    }
  };

  const snooze = () => {
    const until = Date.now() + REMIND_MS;
    try { localStorage.setItem(SNOOZE_KEY, String(until)); } catch { /* noop */ }
    setDismissedUntil(until);
  };

  // Detección periódica (cada 8s) + al recuperar foco/visibilidad.
  useEffect(() => {
    if (loading || isPremium || tvMode) {
      setAdblockActive(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const isBlocking = await detectAdblock();
      if (!cancelled) setAdblockActive(isBlocking);
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

  // Re-evaluar cuando expira el snooze
  useEffect(() => {
    if (!dismissedUntil) return;
    const remaining = dismissedUntil - Date.now();
    if (remaining <= 0) { setDismissedUntil(0); return; }
    const t = window.setTimeout(() => setDismissedUntil(0), remaining + 100);
    return () => clearTimeout(t);
  }, [dismissedUntil]);

  // Anti-hack: si borran el nodo por consola, lo revivimos.
  useEffect(() => {
    if (!visible) return;
    const obs = new MutationObserver(() => {
      if (!nodeRef.current || !document.body.contains(nodeRef.current)) {
        setTick((t) => t + 1);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const iv = window.setInterval(() => {
      if (!nodeRef.current || !document.body.contains(nodeRef.current)) {
        setTick((t) => t + 1);
      }
    }, 800);
    return () => { obs.disconnect(); clearInterval(iv); };
  }, [visible]);

  const goPremium = () => {
    if (!user) {
      toast.info("Primero crea tu cuenta para activar Premium");
      navigate("/auth?redirect=/profile?premium=1");
      return;
    }
    navigate("/profile?premium=1");
  };

  if (!visible) return null;

  // z-index alto pero NO el literal 2147483647 (firma del script de bypass).
  const z = 2147480000 + (tick % 1000);

  return (
    <div
      key={tick}
      ref={nodeRef}
      id={GATE_ID}
      data-zet-guard="1"
      className="fixed left-0 top-0 w-screen h-screen bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
      style={{ zIndex: z, pointerEvents: "auto" }}
    >
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-2xl text-center relative">
        <button
          onClick={snooze}
          aria-label="Recordar más tarde"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Detectamos un bloqueador de anuncios
        </h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          ZetAnime es <span className="text-primary font-semibold">100% gratis</span> gracias a los anuncios.
          Por favor, <span className="font-semibold text-foreground">desactívalo</span> para apoyarnos,
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
          <button
            type="button"
            onClick={snooze}
            className="text-xs text-muted-foreground/70 hover:text-muted-foreground underline underline-offset-2 mt-1"
          >
            Continuar de todas formas (te recordaré en 5 min)
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground/60 mt-4">
          Si usas Brave, Firefox estricto o un DNS con filtros, puede ser un falso positivo.
          Aun así, tus anuncios pagan nuestros servidores. 🧡
        </p>
      </div>
    </div>
  );
}
