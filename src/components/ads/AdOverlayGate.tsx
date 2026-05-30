// Capa bloqueante de anuncio sobre el reproductor.
// Muestra Adsterra 300x250, bloquea clicks al video, y un botón "Cerrar en Xs" deshabilitado
// hasta que termina el contador. Aparece cada N episodios consumidos.
// Premium queda exento por completo.
// IMPORTANTE: en fullscreen usa position:fixed con z-index máximo para que se vea por encima
// del video que está en pantalla completa.
import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import AdsterraBanner from "./AdsterraBanner";

interface Props {
  /** Llave única que cambia con episodio para resetear el contador (ej: `${anilistId}-${episode}`) */
  episodeKey: string;
  /** Cada cuántos episodios mostrar el overlay. Default 3. */
  everyN?: number;
  /** Segundos a esperar antes de poder cerrar. Default 5. */
  countdownSecs?: number;
  /** Llamado cuando el usuario cierra el overlay */
  onClosed?: () => void;
}

const STORAGE_KEY = "zet:ad-overlay-counter";

function getCounter(): { count: number; lastKey: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { count: 0, lastKey: "" };
}

function setCounter(v: { count: number; lastKey: string }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {}
}

export default function AdOverlayGate({
  episodeKey,
  everyN = 3,
  countdownSecs = 5,
  onClosed,
}: Props) {
  const { isPremium, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [secs, setSecs] = useState(countdownSecs);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Detectar fullscreen para usar position:fixed con z-index máximo
  // y aparecer por ENCIMA del video aunque esté en pantalla completa.
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs as any);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs as any);
    };
  }, []);

  // Decide si mostrar al cambiar de episodio
  useEffect(() => {
    if (loading || isPremium || !episodeKey) return;
    const cur = getCounter();
    if (cur.lastKey === episodeKey) return; // ya contado este ep
    const nextCount = cur.count + 1;
    const shouldShow = nextCount % everyN === 0;
    setCounter({ count: nextCount, lastKey: episodeKey });
    if (shouldShow) {
      setShow(true);
      setSecs(countdownSecs);
    }
  }, [episodeKey, isPremium, loading, everyN, countdownSecs]);

  // Tick del contador
  useEffect(() => {
    if (!show || secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [show, secs]);

  if (isPremium || !show) return null;

  const canClose = secs <= 0;

  const handleClose = () => {
    if (!canClose) return;
    setShow(false);
    onClosed?.();
  };

  // En fullscreen → fixed con z-index máximo (por encima del video fullscreen).
  // En modo normal → absolute dentro del player.
  const positionClass = isFullscreen
    ? "fixed inset-0 z-[2147483647]"
    : "absolute inset-0 z-[60]";

  return (
    <div
      className={`${positionClass} bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center gap-4 p-3`}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[10px] uppercase tracking-widest text-white/50">
        Publicidad — Apoya ZetAnime
      </p>

      {/* Anuncio rotativo */}
      <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
        {(() => {
          const rotation = [
            { key: "b411f21fa26a4e8427eb13433959b4e8", w: 300, h: 250 },
            { key: "ab525e23c9a041206c6d3096e5581274", w: 160, h: 300 },
            { key: "1d178d24c436e987f0076c89491f7ba5", w: 728, h: 90 },
          ];
          let h = 0;
          for (let i = 0; i < episodeKey.length; i++) h = (h * 31 + episodeKey.charCodeAt(i)) >>> 0;
          const ad = rotation[h % rotation.length];
          return (
            <AdsterraBanner
              adKey={ad.key}
              width={ad.w}
              height={ad.h}
              uid={`overlay-${episodeKey}-${ad.key.slice(0, 6)}`}
            />
          );
        })()}
      </div>

      {/* Botón cerrar */}
      <button
        onClick={handleClose}
        disabled={!canClose}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
          canClose
            ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
            : "bg-white/10 text-white/50 cursor-not-allowed"
        }`}
      >
        {canClose ? (
          <>
            <X className="w-4 h-4" />
            Cerrar anuncio
          </>
        ) : (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Cerrar en {secs}s...
          </>
        )}
      </button>

      <p className="text-[10px] text-white/40 max-w-[280px] text-center leading-relaxed">
        Hazte Premium para quitar todos los anuncios y disfrutar sin esperas. 🧡
      </p>
    </div>
  );
}
