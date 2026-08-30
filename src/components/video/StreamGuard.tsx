// Guard de streaming: inicia/heartbeat/cierra una sesión de reproducción
// y bloquea el player si el plan no permite más streams simultáneos.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getActiveProfileId } from "@/lib/account-profiles";
import { startStream, heartbeatStream, endStream } from "@/lib/streaming-sessions";
import StreamLimitModal from "./StreamLimitModal";
import { Loader2 } from "lucide-react";

interface Props {
  animeId: number | null;
  episode: number | null;
  children: ReactNode;
}

export default function StreamGuard({ animeId, episode, children }: Props) {
  const { user, loading } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ current: number; limit: number } | null>(null);
  const [starting, setStarting] = useState(true);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  // start
  useEffect(() => {
    if (loading || !user?.id || animeId == null) return;
    let cancel = false;
    setStarting(true);
    (async () => {
      const profileId = getActiveProfileId();
      const r = await startStream(profileId, animeId, episode);
      if (cancel) return;
      if (r.allowed && r.session_id) {
        setSessionId(r.session_id);
        setBlocked(null);
      } else {
        setSessionId(null);
        setBlocked({ current: r.current, limit: r.limit });
      }
      setStarting(false);
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, loading, animeId, episode]);

  // heartbeat
  useEffect(() => {
    if (!sessionId) return;
    // 60 s: el corte por inactividad es a los 90 s, así reducimos a la mitad
    // los UPDATE sobre streaming_sessions (IO de disco / WAL).
    const t = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      heartbeatStream(sessionId).catch(() => {});
    }, 60_000);
    return () => window.clearInterval(t);
  }, [sessionId]);

  // end on unmount or page hide
  useEffect(() => {
    const endIt = () => {
      const id = sessionRef.current;
      if (id) {
        endStream(id).catch(() => {});
        sessionRef.current = null;
      }
    };
    window.addEventListener("pagehide", endIt);
    return () => {
      window.removeEventListener("pagehide", endIt);
      endIt();
    };
  }, []);

  // No desmontar el reproductor al cambiar de episodio: si ya hay una sesión
  // activa, mantenemos children montado mientras se refresca start_stream.
  if (loading || (user && starting && !blocked && !sessionId)) {
    return (
      <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-primary animate-spin" />
      </div>
    );
  }

  if (blocked) {
    return (
      <>
        <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center text-center text-sm text-muted-foreground p-6">
          Tu plan permite {blocked.limit} reproducción(es) simultánea(s).
        </div>
        <StreamLimitModal
          current={blocked.current}
          limit={blocked.limit}
          profileId={getActiveProfileId()}
          animeId={animeId}
          episode={episode}
          onResolved={(id) => {
            setSessionId(id);
            setBlocked(null);
          }}
          onCancel={() => setBlocked(null)}
        />
      </>
    );
  }

  return <>{children}</>;
}
