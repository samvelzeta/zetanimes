import { useEffect, useState } from "react";
import { Loader2, Tv2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { listActiveStreams, endAllOtherStreams, startStream } from "@/lib/streaming-sessions";

interface Props {
  current: number;
  limit: number;
  profileId: string | null;
  animeId: number | null;
  episode: number | null;
  onResolved: (sessionId: string) => void;
  onCancel: () => void;
}

export default function StreamLimitModal({ current, limit, profileId, animeId, episode, onResolved, onCancel }: Props) {
  const { user } = useAuth();
  const [streams, setStreams] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    listActiveStreams(user.id).then(setStreams);
  }, [user]);

  const takeOver = async () => {
    setBusy(true);
    await endAllOtherStreams(null);
    const r = await startStream(profileId, animeId, episode);
    setBusy(false);
    // Avisa a ProfileGate/devices que las sesiones cambiaron → re-chequeo en tiempo real
    try { window.dispatchEvent(new Event("zet:device-sessions-updated")); } catch {}
    if (r.allowed && r.session_id) onResolved(r.session_id);
  };

  return (
    <div className="fixed inset-0 z-[140] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border-2 border-primary/40 rounded-2xl p-6 shadow-2xl text-center relative">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-secondary text-foreground flex items-center justify-center hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
          <Tv2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-black mb-1">Ya estás viendo en otro lado</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Tu plan permite <strong className="text-foreground">{limit}</strong> reproducciones simultáneas. Ahora mismo hay <strong className="text-foreground">{current}</strong> activas.
        </p>

        {streams.length > 0 && (
          <ul className="text-left text-xs space-y-1 mb-4 max-h-32 overflow-y-auto">
            {streams.map((s) => (
              <li key={s.id} className="px-3 py-2 rounded-lg bg-secondary/60 border border-border">
                <span className="font-bold">Dispositivo:</span> {s.device_id?.slice(0, 10)}… · EP {s.episode_number}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <button
            disabled={busy}
            onClick={takeOver}
            className="w-full px-4 py-3 rounded-lg bg-primary text-primary-foreground font-black flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Detener allá y ver aquí
          </button>
          <button
            onClick={() => navigate("/profile?premium=1")}
            className="w-full px-4 py-3 rounded-lg bg-secondary hover:bg-muted text-sm font-bold"
          >
            Mejorar mi plan
          </button>
        </div>
      </div>
    </div>
  );
}
