import { getWatchHistory, type WatchHistoryEntry } from "@/lib/zetapi";
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

  if (history.length === 0) {
    return (
      <div className="min-h-screen pt-4 px-4 pb-24">
        <h1 className="text-xl font-black text-foreground mb-6 tracking-tight">Reproducidos Recientemente</h1>
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Clock className="w-10 h-10 text-muted" />
          <p className="text-muted-foreground text-sm">Aún no has visto nada.</p>
          <Link to="/" className="text-primary text-xs font-medium mt-2">Explorar animes →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-4 px-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black text-foreground tracking-tight">Reproducidos Recientemente</h1>
        <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition">
          <Trash2 className="w-3.5 h-3.5" /> Limpiar
        </button>
      </div>
      <div className="space-y-3">
        {history.map((entry) => {
          const progressPct = Math.round(entry.progress * 100);
          return (
            <Link key={entry.episodeSlug} to={`/watch/${entry.anilistId || entry.animeSlug}?ep=${entry.episodeNumber}`} className="flex gap-3 bg-secondary rounded-xl p-3 hover:bg-muted transition-colors group">
              <div className="relative w-20 h-28 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {entry.animeCover ? <img src={entry.animeCover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play className="w-6 h-6 text-muted-foreground" /></div>}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50"><div className="h-full bg-primary rounded-full" style={{ width: `${progressPct}%` }} /></div>
              </div>
              <div className="flex-1 min-w-0 py-1">
                <p className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">{entry.animeTitle}</p>
                <p className="text-xs text-muted-foreground mt-1">Episodio {entry.episodeNumber}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{progressPct}% visto</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(entry.timestamp).toLocaleDateString("es")}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
