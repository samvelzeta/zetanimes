import { Crown, ShieldX, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  current: number;
  limit: number;
  onClose?: () => void;
}

export default function DeviceLimitModal({ current, limit, onClose }: Props) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[120] bg-background/60 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-panel-strong rounded-2xl p-6 text-center border-destructive/40">

        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground hover:bg-muted"
            aria-label="Cerrar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-black mb-2">Demasiadas reproducciones</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Tienes <strong className="text-foreground">{current}/{limit}</strong> dispositivos activos.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Tu plan permite <strong className="text-foreground">{limit}</strong> reproducción(es) simultánea(s). Cierra una sesión desde tu perfil o mejora tu plan.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => { onClose?.(); navigate("/profile?premium=1"); }}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-black flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Crown className="w-4 h-4" /> Mejorar mi plan
          </button>
          <button
            onClick={() => { onClose?.(); navigate("/profile"); }}
            className="w-full px-4 py-3 rounded-lg bg-secondary hover:bg-muted text-sm font-bold"
          >
            Gestionar mis dispositivos
          </button>
        </div>
      </div>
    </div>
  );
}
