// Overlay de aviso de Adblock DENTRO del reproductor.
// Se muestra cada REMIND_MS (1 min) de reproducción mientras el adblock siga
// detectado, siguiendo la misma UX que AdOverlayGate (pausa el video,
// cuenta atrás para cerrar, misma capa absoluta dentro de #zet-player-container).
// Si el adblock ya no está detectado, no hace nada y los anuncios normales
// (AdOverlayGate) siguen funcionando como siempre.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, RefreshCw, Crown, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { detectAdblock } from "@/lib/adblock-detect";
import { toast } from "sonner";

const REMIND_MS = 60 * 1000; // 1 min
const COUNTDOWN = 5;

export default function AdblockPlayerOverlay() {
  const { isPremium, loading, user } = useAuth();
  const navigate = useNavigate();
  const [adblockActive, setAdblockActive] = useState(false);
  const [show, setShow] = useState(false);
  const [secs, setSecs] = useState(COUNTDOWN);
  const [checking, setChecking] = useState(false);
  const lastShownRef = useRef<number>(Date.now()); // difiere el 1er aviso 1 min

  // Detección adblock periódica
  useEffect(() => {
    if (loading || isPremium) { setAdblockActive(false); return; }
    let cancelled = false;
    const check = async () => {
      const b = await detectAdblock();
      if (!cancelled) setAdblockActive(b);
    };
    const t0 = window.setTimeout(check, 1500);
    const iv = window.setInterval(check, 10000);
    return () => { cancelled = true; clearTimeout(t0); clearInterval(iv); };
  }, [loading, isPremium]);

  // Loop: cada 5s revisa si toca mostrar (adblock activo + >=1 min desde el último aviso)
  useEffect(() => {
    if (isPremium || loading) return;
    const tick = () => {
      if (show) return;
      if (!adblockActive) return;
      if (Date.now() - lastShownRef.current < REMIND_MS) return;
      setShow(true);
      setSecs(COUNTDOWN);
      lastShownRef.current = Date.now();
    };
    const iv = window.setInterval(tick, 3000);
    return () => clearInterval(iv);
  }, [adblockActive, show, isPremium, loading]);

  // Pausa el video mientras se muestra
  useEffect(() => {
    if (!show) return;
    const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
    if (!video) return;
    const pause = () => video.pause();
    pause();
    video.addEventListener("play", pause);
    return () => video.removeEventListener("play", pause);
  }, [show]);

  // Countdown
  useEffect(() => {
    if (!show || secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [show, secs]);

  const canClose = secs <= 0;

  const runCheck = async () => {
    setChecking(true);
    try {
      await new Promise((r) => setTimeout(r, 500));
      const b = await detectAdblock();
      setAdblockActive(b);
      if (!b) {
        toast.success("¡Anuncios desbloqueados! Gracias 🧡");
        setShow(false);
        window.setTimeout(() => {
          const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
          video?.play().catch(() => undefined);
        }, 0);
      } else {
        toast.error("Aún detectamos el bloqueador.");
      }
    } finally { setChecking(false); }
  };

  const close = () => {
    if (!canClose) return;
    setShow(false);
    lastShownRef.current = Date.now();
    window.setTimeout(() => {
      const video = document.querySelector("#zet-player-container video") as HTMLVideoElement | null;
      video?.play().catch(() => undefined);
    }, 0);
  };

  const goPremium = () => {
    if (!user) {
      navigate("/auth?redirect=/profile?premium=1");
      return;
    }
    navigate("/profile?premium=1");
  };

  const active = show && !isPremium;

  return (
    <div
      aria-hidden={!active}
      className="absolute inset-0 z-[60] bg-background/95 backdrop-blur-sm flex-col items-center justify-center gap-3 p-4"
      style={{ display: active ? "flex" : "none" }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-14 h-14 rounded-full bg-destructive/15 flex items-center justify-center">
        <ShieldAlert className="w-7 h-7 text-destructive" />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-white/50">Publicidad — Apoya ZetAnime</p>
      <h3 className="text-lg font-bold text-foreground text-center">
        Detectamos un bloqueador de anuncios
      </h3>
      <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
        Desactiva tu adblock para seguir viendo gratis, o hazte{" "}
        <span className="text-primary font-semibold">Premium</span> y quita todos los anuncios.
      </p>

      <div className="flex flex-col gap-2 w-full max-w-xs mt-1">
        <button
          onClick={runCheck}
          disabled={checking}
          className="w-full h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Comprobando…" : "Ya lo desactivé"}
        </button>
        <button
          onClick={goPremium}
          className="w-full h-10 rounded-full border border-primary/40 text-primary text-sm font-bold flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4" />
          Hazte Premium
        </button>
        <button
          onClick={close}
          disabled={!canClose}
          className={`w-full h-9 rounded-full text-xs font-bold flex items-center justify-center gap-2 transition ${
            canClose ? "bg-white/10 text-white hover:bg-white/15" : "bg-white/5 text-white/40 cursor-not-allowed"
          }`}
        >
          {canClose ? (<><X className="w-3.5 h-3.5" /> Continuar de todas formas</>) : (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Espera {secs}s…</>)}
        </button>
      </div>
    </div>
  );
}
