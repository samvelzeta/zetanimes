import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "react-router-dom";

const KEY = "zet:cookie-consent-v1";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) {
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    } catch { /* noop */ }
  }, []);

  const accept = () => {
    try { localStorage.setItem(KEY, "accepted"); } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-[9999] animate-in fade-in slide-in-from-bottom-4">
      <div className="rounded-2xl border border-primary/40 bg-background/95 backdrop-blur-lg shadow-2xl shadow-primary/20 p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Cookie className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground mb-1">Cookies y anuncios</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Usamos cookies propias y de terceros (analítica y anuncios) para que ZetAnime funcione y podamos
              sostener el sitio. Al continuar navegando aceptas su uso. Lee más en{" "}
              <Link to="/terms" className="text-primary hover:underline font-bold">Términos</Link>.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={accept}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-black uppercase tracking-wider hover:opacity-90 transition"
              >
                Aceptar
              </button>
              <Link
                to="/dmca"
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition"
              >
                DMCA
              </Link>
            </div>
          </div>
          <button
            onClick={accept}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
