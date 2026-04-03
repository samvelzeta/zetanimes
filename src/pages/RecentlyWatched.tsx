import { useState, useEffect } from "react";
import { Play, Trash2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface WatchEntry {
  id: string;
  anime_id: number;
  anime_title: string | null;
  anime_cover: string | null;
  episode_number: number;
  current_time_seconds: number;
  total_duration_seconds: number;
  progress_percent: number;
  completed: boolean | null;
  created_at: string;
}

export default function RecentlyWatched() {
  const { user } = useAuth();
  const [history, setHistory] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data as unknown as WatchEntry[]) || []);
    setLoading(false);
  };

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("watch_history").delete().eq("user_id", user.id);
    setHistory([]);
  };

  const removeEntry = async (id: string) => {
    await supabase.from("watch_history").delete().eq("id", id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-4 px-4 pb-24">
        <h1 className="text-xl font-black text-foreground mb-6 tracking-tight">Reproducidos Recientemente</h1>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Clock className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Inicia sesión para ver tu historial.</p>
          <Link to="/auth" className="text-primary text-xs font-medium mt-2">Iniciar sesión →</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-4 px-4 pb-24">
        <h1 className="text-xl font-black text-foreground mb-6 tracking-tight">Reproducidos Recientemente</h1>
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="min-h-screen pt-4 px-4 pb-24">
        <h1 className="text-xl font-black text-foreground mb-6 tracking-tight">Reproducidos Recientemente</h1>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Clock className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Aún no has visto nada.</p>
          <Link to="/" className="text-primary text-xs font-medium mt-2">Explorar animes →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-4 px-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black text-foreground tracking-tight">Recientes</h1>
        <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition">
          <Trash2 className="w-3.5 h-3.5" /> Limpiar
        </button>
      </div>
      <div className="space-y-3">
        {history.map((entry) => {
          const progressPct = Math.round(entry.progress_percent || 0);
          const currentMin = Math.floor((entry.current_time_seconds || 0) / 60);
          const currentSec = Math.floor((entry.current_time_seconds || 0) % 60);
          const durationMin = Math.floor((entry.total_duration_seconds || 0) / 60);
          const durationSec = Math.floor((entry.total_duration_seconds || 0) % 60);
          const timeStr = (entry.total_duration_seconds || 0) > 0
            ? `${currentMin}:${currentSec.toString().padStart(2, "0")} / ${durationMin}:${durationSec.toString().padStart(2, "0")}`
            : "";

          return (
            <div key={entry.id} className="flex gap-3 bg-secondary rounded-xl p-3 group relative">
              <Link
                to={`/watch/${entry.anime_id}?ep=${entry.episode_number}`}
                className="flex gap-3 flex-1 min-w-0"
              >
                <div className="relative w-28 h-[4.5rem] rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {entry.anime_cover ? (
                    <img src={entry.anime_cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-secondary">
                      <Play className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                  {(entry.total_duration_seconds || 0) > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <p className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                    {entry.anime_title || "Anime"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Episodio {entry.episode_number}
                  </p>
                  {timeStr && <p className="text-[10px] text-muted-foreground mt-0.5">{timeStr}</p>}
                  <span className="text-[10px] text-primary font-medium mt-1 block">
                    {progressPct >= 90 ? "✓ Completado" : (entry.total_duration_seconds || 0) > 0 ? `Continuar viendo · ${progressPct}%` : "Empezar a ver"}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => removeEntry(entry.id)}
                className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
