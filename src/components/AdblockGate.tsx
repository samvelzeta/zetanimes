// Bloquea el uso de la app si detecta un adblock activo en usuarios free.
// Modal full-screen con dos opciones: reintentar o ir a Premium.
// Premium queda exento (sus anuncios son 0×0).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, RefreshCw, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { detectAdblock } from "@/lib/adblock-detect";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdblockGate() {
  const { isPremium, loading, user } = useAuth();
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    try {
      // Pequeño respiro para que el navegador termine de aplicar cambios
      // tras desactivar la extensión.
      await new Promise((r) => setTimeout(r, 600));
      const isBlocking = await detectAdblock();
      setBlocked(isBlocking);
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
    if (loading || isPremium) return;
    const t = window.setTimeout(async () => {
      const isBlocking = await detectAdblock();
      setBlocked(isBlocking);
    }, 1500);
    return () => clearTimeout(t);
  }, [loading, isPremium]);

  const goPremium = () => {
    setBlocked(false); // cerrar el modal para no bloquear navegación
    if (!user) {
      toast.info("Primero crea tu cuenta para activar Premium");
      navigate("/auth?redirect=/profile?premium=1");
      return;
    }
    // Usuario logueado → al perfil con flag para auto-abrir el modal de membresía
    navigate("/profile?premium=1");
  };

  if (isPremium || !blocked) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483647] bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
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
          <Button
            type="button"
            onClick={runCheck}
            disabled={checking}
            className="w-full"
            size="lg"
          >
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
