// Alerta global de expiración: aparece SOLO en los últimos 5 días
// de una membresía premium activa. Se puede cerrar o ir a renovar.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const DISMISS_KEY = "zet:expiry-alert-dismissed";

function dayKey(userId: string, daysLeft: number) {
  // Por cuenta + fecha + días restantes — así cada cuenta/sesión tiene su propia alerta
  return `${DISMISS_KEY}:${userId}:${new Date().toISOString().slice(0, 10)}:${daysLeft}`;
}

export default function ExpiryAlert() {
  const { user, loading } = useAuth();
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) {
      setOpen(false);
      return;
    }
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("premium_memberships")
        .select("expires_at, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancel || !data?.expires_at) return;
      const ms = new Date(data.expires_at).getTime() - Date.now();
      const days = Math.ceil(ms / 86_400_000);
      if (days <= 0 || days > 5) return;
      const key = dayKey(user.id, days);
      if (sessionStorage.getItem(key)) return;
      setExpiresAt(data.expires_at);
      setDaysLeft(days);
      setOpen(true);
    })();
    return () => { cancel = true; };
  }, [user?.id, loading]);

  if (!open || daysLeft == null) return null;

  const isLast = daysLeft <= 1;
  const expDate = expiresAt ? new Date(expiresAt) : null;
  const hourLabel = expDate?.toLocaleString("es-MX", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });

  const close = () => {
    sessionStorage.setItem(dayKey(daysLeft), "1");
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[180] bg-background/90 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-card border-2 border-primary/50 rounded-2xl p-6 shadow-2xl text-center relative">
        <button
          onClick={close}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-secondary text-foreground flex items-center justify-center hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
          <Crown className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-black mb-1">
          {isLast ? "¡Tu Premium vence hoy!" : `Tu Premium vence en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`}
        </h2>
        <p className="text-sm text-muted-foreground mb-5">
          {isLast
            ? `Hoy ${hourLabel ?? ""} se desactivan los beneficios. Renueva para no perder tu plan.`
            : `Renueva antes del ${hourLabel ?? ""} para no perder tus perfiles, streams y demás beneficios.`}
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => { close(); navigate("/profile?premium=1"); }}
            className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-black hover:opacity-90"
          >
            Renovar ahora
          </button>
          <button
            onClick={close}
            className="w-full px-4 py-2 rounded-lg bg-secondary hover:bg-muted text-xs font-bold"
          >
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
