// Bloquea el uso de la app si detecta un adblock activo en usuarios free.
// Muestra un modal full-screen con dos opciones: desactivar adblock o ir a Premium.
// Premium queda exento (sus anuncios son 0×0 igualmente).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, RefreshCw, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { detectAdblock } from "@/lib/adblock-detect";
import { Button } from "@/components/ui/button";

export default function AdblockGate() {
  const { isPremium, loading } = useAuth();
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try {
      const isBlocking = await detectAdblock();
      setBlocked(isBlocking);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (loading || isPremium) return;
    // Pequeño delay para dar tiempo a que carguen los scripts y evitar falsos positivos
    const t = window.setTimeout(runCheck, 1500);
    return () => clearTimeout(t);
  }, [loading, isPremium]);

  if (isPremium || !blocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
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
          <Button onClick={runCheck} disabled={checking} className="w-full" size="lg">
            <RefreshCw className={`w-4 h-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Comprobando…" : "Ya lo desactivé, reintentar"}
          </Button>
          <Link to="/settings">
            <Button variant="outline" className="w-full border-primary/40 text-primary" size="lg">
              <Crown className="w-4 h-4 mr-2" />
              Hazte Premium (sin anuncios)
            </Button>
          </Link>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-4">
          Tu apoyo paga los servidores y permite agregar más capítulos. ¡Gracias! 🧡
        </p>
      </div>
    </div>
  );
}
