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

function formatRemaining(entry: WatchEntry) {
  const total = entry.total_duration_seconds || 0;
  const cur = entry.current_time_seconds || 0;
  if (total <= 0) return "Empezar";
  const remaining = Math.max(0, total - cur);
  const min = Math.round(remaining / 60);
  if (min < 1) return "Casi listo";
  if (min < 60) return `${min} min restantes`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m restantes`;
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
        <h1 className="text-xl font-black text-foreground mb-4 tracking-tight">Recientes</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="aspect-video skeleton-zet rounded-none" />
          ))}
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
    <div className="min-h-screen pt-4 pb-24">
      <div className="flex items-center justify-between mb-4 px-4">
        <h1 className="text-xl font-black text-foreground tracking-tight">Recientes</h1>
        <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition">
          <Trash2 className="w-3.5 h-3.5" /> Limpiar
        </button>
      </div>

      {/* Netflix-style horizontal cards in grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 px-4">
        {history.map((entry) => {
          const progressPct = Math.round(entry.progress_percent || 0);
          const remaining = formatRemaining(entry);

          return (
            <div
              key={entry.id}
              className="group relative overflow-hidden bg-card border border-border hover:border-primary/40 transition-all duration-300"
              style={{ borderRadius: 0 }}
            >
              <Link
                to={`/watch/${entry.anime_id}?ep=${entry.episode_number}`}
                className="block relative aspect-video"
              >
                {entry.anime_cover ? (
                  <img
                    src={entry.anime_cover}
                    alt={entry.anime_title || ""}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <Play className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}

                {/* Degradado oscuro abajo Netflix-style */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

                {/* Botón play centrado al hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="w-14 h-14 rounded-full bg-primary/95 flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-6 h-6 text-primary-foreground fill-primary-foreground ml-0.5" />
                  </div>
                </div>

                {/* Info abajo */}
                <div className="absolute bottom-0 left-0 right-0 p-3 pb-4">
                  <p className="text-sm font-black text-white line-clamp-1 drop-shadow-lg">
                    {entry.anime_title || "Anime"}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      EP {entry.episode_number}
                    </span>
                    <span className="text-[10px] text-white/80 font-medium">
                      {progressPct >= 90 ? "✓ Visto" : remaining}
                    </span>
                  </div>
                </div>

                {/* Barra de progreso inferior bordes cuadrados */}
                {(entry.total_duration_seconds || 0) > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${progressPct}%`, boxShadow: "0 0 8px hsl(var(--primary))" }}
                    />
                  </div>
                )}
              </Link>

              <button
                onClick={() => removeEntry(entry.id)}
                className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/70 backdrop-blur text-white/80 hover:text-destructive hover:bg-destructive/20 transition opacity-0 group-hover:opacity-100"
                style={{ borderRadius: 0 }}
                aria-label="Eliminar"
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
