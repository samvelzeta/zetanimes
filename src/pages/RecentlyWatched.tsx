import { getWatchHistory, saveWatchProgress, type WatchHistoryEntry } from "@/lib/zetapi";
import { useState, useEffect } from "react";
import { Play, Trash2, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export default function RecentlyWatched() {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getWatchHistory());
  }, []);

  const clearHistory = () => {
    localStorage.removeItem("zet_watch_history");
    setHistory([]);
  };

  const removeEntry = (episodeSlug: string) => {
    const updated = history.filter((h) => h.episodeSlug !== episodeSlug);
    localStorage.setItem("zet_watch_history", JSON.stringify(updated));
    setHistory(updated);
  };

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
          const progressPct = Math.round(entry.progress * 100);
          const currentMin = Math.floor(entry.currentTime / 60);
          const currentSec = Math.floor(entry.currentTime % 60);
          const durationMin = Math.floor(entry.duration / 60);
          const durationSec = Math.floor(entry.duration % 60);
          const timeStr = `${currentMin}:${currentSec.toString().padStart(2, "0")} / ${durationMin}:${durationSec.toString().padStart(2, "0")}`;

          return (
            <Link
              key={entry.episodeSlug}
              to={`/watch/${entry.anilistId || entry.animeSlug}?ep=${entry.episodeNumber}`}
              className="flex gap-3 bg-secondary rounded-xl p-3 hover:bg-muted transition-colors group"
            >
              <div className="relative w-24 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {entry.animeCover ? (
                  <img src={entry.animeCover} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary">
                    <Play className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white fill-white" />
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                  {entry.animeTitle}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Episodio {entry.episodeNumber}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{timeStr}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-primary font-medium">
                    {progressPct >= 90 ? "✓ Completado" : `Continuar viendo · ${progressPct}%`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleDateString("es")}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
