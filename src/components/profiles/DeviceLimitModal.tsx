import { Crown, ShieldX } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  current: number;
  limit: number;
  onClose?: () => void;
}

export default function DeviceLimitModal({ current, limit, onClose }: Props) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-[120] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border-2 border-destructive/40 rounded-2xl p-6 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-black mb-2">Límite de dispositivos</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Tienes <strong className="text-foreground">{current}/{limit}</strong> dispositivos conectados.
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Cierra sesión en otro dispositivo desde tu perfil o hazte Premium para tener hasta <strong className="text-foreground">5 dispositivos</strong> simultáneos.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => { onClose?.(); navigate("/profile?premium=1"); }}
            className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-black flex items-center justify-center gap-2 hover:opacity-90"
          >
            <Crown className="w-4 h-4" /> Hazte Premium
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
