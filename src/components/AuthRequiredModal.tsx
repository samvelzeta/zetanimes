import { Link } from "react-router-dom";
import { LogIn, X } from "lucide-react";

interface Props {
  onClose: () => void;
  message?: string;
}

export default function AuthRequiredModal({ onClose, message }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground flex items-center gap-2">
            <LogIn className="w-5 h-5 text-primary" />
            Cuenta requerida
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          {message || "Debes iniciar sesión para acceder a esta función. Regístrate gratis para guardar tu progreso, crear listas y más."}
        </p>
        <div className="flex gap-3">
          <Link
            to="/auth"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm text-center hover:bg-primary/90 transition"
          >
            Iniciar Sesión
          </Link>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-secondary text-muted-foreground font-bold text-sm hover:bg-muted transition"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
