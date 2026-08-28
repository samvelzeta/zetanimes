import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";

const MESSAGES = [
  { emoji: "📌", text: "¿Te gusta este anime? Regístrate gratis para guardar tu progreso.", cta: "Crear cuenta", to: "/auth" },
  { emoji: "⚡", text: "Descarga la app para acceder más rápido y sin interrupciones.", cta: "Descargar ahora", to: "/download" },
  { emoji: "🔔", text: "¡No te pierdas los estrenos! Crea tu cuenta y recibe alertas.", cta: "Unirme", to: "/auth" },
  { emoji: "⭐", text: "Crea tu lista de favoritos y arma tu maratón personal.", cta: "Registrarme", to: "/auth" },
  { emoji: "💬", text: "Únete a la comunidad: reporta, califica y personaliza tu perfil.", cta: "Crear cuenta", to: "/auth" },
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
    <div className="w-full h-10 bg-background/95 border-b border-primary/30 flex items-center gap-2 px-2 overflow-hidden relative">
      <button
        onClick={() => { setVisible(false); try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch {} }}
        className="flex-shrink-0 h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>
      <Link
        to={msg.to}
        className="h-6 px-2.5 rounded bg-primary text-primary-foreground text-[11px] font-bold flex items-center flex-shrink-0 hover:opacity-90 transition"
      >
        {msg.cta}
      </Link>
      <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
        <span className="text-sm flex-shrink-0">{msg.emoji}</span>
        <p className="text-xs text-foreground/90 truncate transition-opacity duration-500">{msg.text}</p>
      </div>
    </div>
  );
}
