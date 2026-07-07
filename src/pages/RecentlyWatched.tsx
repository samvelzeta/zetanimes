import { useState, useEffect } from "react";
import { Play, Trash2, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
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

function formatTime(s: number) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function RecentlyWatched() {
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const profileId = activeProfile?.id ?? null;
  const [history, setHistory] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileId]);

  const loadHistory = async () => {
    if (!user) return;
    let q = supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", user.id);
    q = profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
    const { data } = await q.order("created_at", { ascending: false }).limit(30);
    setHistory((data as unknown as WatchEntry[]) || []);
    setLoading(false);
  };

  const clearHistory = async () => {
    if (!user) return;
    let q = supabase.from("watch_history").delete().eq("user_id", user.id);
    q = profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
    await q;
    setHistory([]);
  };

  const removeEntry = async (id: string) => {
    await supabase.from("watch_history").delete().eq("id", id);
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-4 px-4 pb-24">
        <h1 className="text-2xl font-black text-foreground mb-6 tracking-tight">Recientes</h1>
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
        <h1 className="text-2xl font-black text-foreground mb-4 tracking-tight">Recientes</h1>
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-28 bg-secondary rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="min-h-screen pt-4 px-4 pb-24">
        <h1 className="text-2xl font-black text-foreground mb-6 tracking-tight">Recientes</h1>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Clock className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Aún no has visto nada.</p>
          <Link to="/" className="text-primary text-xs font-medium mt-2">Explorar animes →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-4 pb-24 px-4">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-foreground tracking-tight">Recientes</h1>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition font-medium"
        >
          <Trash2 className="w-4 h-4" /> Limpiar
        </button>
      </div>

      {/* Grid responsivo tipo bloque */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {history.map((entry) => {
          const total = entry.total_duration_seconds || 0;
          const cur = entry.current_time_seconds || 0;
          const pct = Math.round(entry.progress_percent || 0);
          const completed = (entry.completed === true) || pct >= 90;
          const started = total > 0 && cur > 0;

          let statusLabel = "Empezar a ver";
          if (completed) statusLabel = "✓ Completado";
          else if (started) statusLabel = `Continuar viendo · ${pct}%`;

          return (
            <div
              key={entry.id}
              className="group relative flex flex-col bg-card/60 rounded-xl overflow-hidden border border-border/60 transition-all duration-300 hover:scale-[1.03] hover:border-primary hover:shadow-[0_0_18px_hsl(var(--primary)/0.3)]"
            >
              <Link
                to={`/watch/${entry.anime_id}?ep=${entry.episode_number}`}
                className="flex flex-col"
              >
                {/* Thumbnail 16:9 */}
                <div className="relative w-full aspect-video overflow-hidden bg-secondary">
                  {entry.anime_cover ? (
                    <img
                      src={entry.anime_cover}
                      alt={entry.anime_title || ""}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Play className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}

                  {/* Play hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/30">
                    <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary))]">
                      <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
                    </div>
                  </div>

                  {/* Barra de progreso gráfica */}
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-black/60">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${completed ? 100 : pct}%` }}
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-base font-bold text-foreground line-clamp-1">
                    {entry.anime_title || "Anime"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Episodio {entry.episode_number}
                  </p>
                  <p className="text-xs text-primary font-semibold mt-2 line-clamp-1">
                    {statusLabel}
                  </p>
                  {started && !completed && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {formatTime(cur)} / {formatTime(total)}
                    </p>
                  )}
                </div>
              </Link>

              {/* Eliminar (aparece en hover) */}
              <button
                onClick={() => removeEntry(entry.id)}
                className="absolute top-2 right-2 p-2 rounded-full bg-black/60 backdrop-blur text-white/80 hover:text-destructive hover:bg-destructive/20 transition opacity-0 group-hover:opacity-100 z-10"
                aria-label="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
