// Aviso flotante cuando el apoyo está por expirar (últimos 7 días).
// El cron `premium-expiry-notifier` ya crea una notificación oficial 5 días antes;
// esto es un banner visual adicional para que el usuario no lo pase por alto.
import { useEffect, useState } from "react";
import { Heart, X, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const KOFI_URL = "https://ko-fi.com/zetanimes";
const DISMISS_KEY = "zet:expiry-alert-dismissed";

export default function ExpiryAlert() {
  const { profile, isPremium, isOwner } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const today = new Date().toDateString();
    setDismissed(localStorage.getItem(DISMISS_KEY) === today);
  }, [profile?.user_id]);

  if (isOwner || !isPremium || !profile?.subscription_expires_at) return null;

  const expires = new Date(profile.subscription_expires_at);
  const msLeft = expires.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86400000);

  if (daysLeft > 7 || daysLeft < 0 || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, new Date().toDateString());
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-[90] max-w-md w-[calc(100%-1rem)] px-4">
      <div className="rounded-2xl border-2 border-primary/50 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/30 p-3 flex items-center gap-3 animate-in slide-in-from-bottom-4">
        <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Heart className="w-5 h-5 text-primary" fill="currentColor" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-foreground leading-tight">
            Tu apoyo termina en {daysLeft} día{daysLeft === 1 ? "" : "s"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
            Renueva tu aporte para seguir disfrutando los beneficios.
          </p>
        </div>
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-black hover:opacity-90 transition"
        >
          Apoyar <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={handleDismiss}
          className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
