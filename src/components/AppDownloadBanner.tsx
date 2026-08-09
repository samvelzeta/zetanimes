import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Download, X, Smartphone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isWebView } from "@/lib/webview";
import logoUrl from "@/assets/zetanime-apk-logo.png";

const DISMISS_KEY = "zet_app_banner_dismissed";

export default function AppDownloadBanner() {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading || user || typeof window === "undefined" || isWebView()) return;
    setVisible(!sessionStorage.getItem(DISMISS_KEY));
  }, [user, loading]);

  const dismiss = () => {
    setVisible(false);
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
  };

  if (!visible) return null;

  return (
    <div className="relative mx-2 sm:mx-4 mt-2 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-secondary/40 to-primary/10 backdrop-blur-sm overflow-hidden shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
      {/* Línea de acento sutil */}
      <div className="absolute inset-y-0 left-0 w-1 bg-primary/60" />

      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-black/40 flex-shrink-0 overflow-hidden border border-white/10">
          <img src={logoUrl} alt="zetAnime" className="w-full h-full object-contain" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
            Lleva zetAnime en tu bolsillo
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight truncate">
            App Android: más rápida, sin anuncios visuales y con notificaciones.
          </p>
        </div>

        <Link
          to="/download"
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-primary text-primary-foreground text-[10px] sm:text-xs font-medium hover:shadow-[0_0_14px_hsl(var(--primary)/0.5)] transition active:scale-95"
        >
          <Download className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Descargar</span>
          <span className="sm:hidden">App</span>
        </Link>

        <button
          onClick={dismiss}
          className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-muted-foreground hover:text-foreground transition"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
