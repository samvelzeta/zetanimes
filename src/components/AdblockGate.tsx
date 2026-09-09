// Modo estricto: el aviso NO se puede cerrar hasta desactivar el bloqueador.
// - Fuera del reproductor: modal cerrable superpuesto.
// - Dentro del reproductor (/watch): NO se muestra aquí. El componente
//   AdblockPlayerOverlay lo muestra como "anuncio" dentro del player,
//   intercalado con los anuncios normales.
// Anti-bypass: id/atributos aleatorios en cada montaje (sin prefijo "zet-guard-"),
// z-index no literal 2147483647, MutationObserver + revive.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ShieldAlert, RefreshCw, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { detectAdblock } from "@/lib/adblock-detect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isTV } from "@/hooks/useIsTV";


function rndTag(len = 8) {
  const s = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += s[Math.floor(Math.random() * s.length)];
  return out;
}

export default function AdblockGate() {
  const { isPremium, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [adblockActive, setAdblockActive] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tick, setTick] = useState(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const tvMode = typeof window !== "undefined" && isTV();
  const onWatch = location.pathname.startsWith("/watch");

  // Identificadores aleatorios por montaje (evita selectores como
  // `[id^="zet-guard-"]` o `[data-zet-guard]`).
  const ids = useMemo(() => ({
    id: rndTag(10),
    attrName: `data-${rndTag(6)}`,
    attrVal: rndTag(6),
  }), []);

  const now = Date.now();
  const visible = adblockActive && !isPremium && !tvMode && !onWatch;

  const runCheck = async () => {
    setChecking(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const isBlocking = await detectAdblock();
      setAdblockActive(isBlocking);
      if (!isBlocking) {
        toast.success("¡Anuncios desbloqueados! Gracias 🧡");
      } else {
        toast.error("Aún detectamos el bloqueador. Intenta de nuevo.");
      }
    } finally {
      setChecking(false);
    }
  };

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

  useEffect(() => {
    if (!visible) return;
    const parent = nodeRef.current?.parentElement || document.body;
    const obs = new MutationObserver(() => {
      if (!nodeRef.current || !document.body.contains(nodeRef.current)) {
        setTick((t) => t + 1);
      }
    });
    // Scope reducido: solo hijos directos del padre, no todo el árbol
    obs.observe(parent, { childList: true, subtree: false });
    // Chequeo mucho menos frecuente como fallback
    const iv = window.setInterval(() => {
      if (!nodeRef.current || !document.body.contains(nodeRef.current)) {
        setTick((t) => t + 1);
      }
    }, 5000);
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

  const z = 2147480000 + (tick % 1000);

  return (
    <div
      key={tick}
      ref={nodeRef}
      id={ids.id}
      {...{ [ids.attrName]: ids.attrVal }}
      className="fixed left-0 top-0 w-screen h-screen bg-background/80 backdrop-blur-md flex items-center justify-center p-4"
      style={{ zIndex: z, pointerEvents: "auto" }}
    >
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-2xl text-center relative">
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
        </div>

        <p className="text-[10px] text-muted-foreground/60 mt-4">
          Si usas Brave, Firefox estricto o un DNS con filtros, puede ser un falso positivo.
          Aun así, tus anuncios pagan nuestros servidores. 🧡
        </p>
      </div>
    </div>
  );
}
