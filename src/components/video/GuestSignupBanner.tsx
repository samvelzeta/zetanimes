import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const MESSAGES = [
  { emoji: "📌", text: "¿Te gusta este anime? Regístrate gratis para guardar tu progreso.", cta: "Crear cuenta" },
  { emoji: "🔔", text: "¡No te pierdas los estrenos! Crea tu cuenta y recibe alertas.", cta: "Unirme" },
  { emoji: "⭐", text: "Crea tu lista de favoritos y arma tu maratón personal.", cta: "Registrarme" },
  { emoji: "💬", text: "Únete a la comunidad: reporta, califica y personaliza tu perfil.", cta: "Crear cuenta" },
];

const INTERVAL = 6000;
const STORAGE_KEY = "zet:guest-banner-dismissed";

export default function GuestSignupBanner() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) !== "1"; } catch { return true; }
  });

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), INTERVAL);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const msg = MESSAGES[index];

  return (
    <div className="w-full h-10 bg-background/95 border-b border-primary/30 flex items-center justify-between px-3 overflow-hidden relative">
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        <span className="text-sm flex-shrink-0">{msg.emoji}</span>
        <p className="text-xs text-foreground/90 truncate transition-opacity duration-500">{msg.text}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <Link
          to="/auth"
          className="h-6 px-2.5 rounded bg-primary text-primary-foreground text-[11px] font-bold flex items-center hover:opacity-90 transition"
        >
          {msg.cta}
        </Link>
        <button
          onClick={() => { setVisible(false); try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {} }}
          className="text-muted-foreground hover:text-foreground transition"
          aria-label="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
