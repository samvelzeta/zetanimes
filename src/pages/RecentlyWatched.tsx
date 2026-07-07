import { useState, useEffect, useMemo } from "react";
import { Play, Trash2, Clock, Flame } from "lucide-react";
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

interface GroupedAnime {
  anime_id: number;
  anime_title: string;
  anime_cover: string | null;
  latestEpisode: number;
  latestEntry: WatchEntry;
  episodesCount: number;
  completedCount: number;
  totalSecondsThisWeek: number;
  avgProgress: number;
}

function formatTime(s: number) {
  if (!s || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function groupHistory(history: WatchEntry[]): GroupedAnime[] {
  const map = new Map<number, GroupedAnime>();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const h of history) {
    const existing = map.get(h.anime_id);
    const isRecent = new Date(h.created_at).getTime() >= weekAgo;
    if (!existing) {
      map.set(h.anime_id, {
        anime_id: h.anime_id,
        anime_title: h.anime_title || "Anime",
        anime_cover: h.anime_cover,
        latestEpisode: h.episode_number,
        latestEntry: h,
        episodesCount: 1,
        completedCount: h.completed || (h.progress_percent || 0) >= 90 ? 1 : 0,
        totalSecondsThisWeek: isRecent ? h.current_time_seconds || 0 : 0,
        avgProgress: h.progress_percent || 0,
      });
    } else {
      existing.episodesCount += 1;
      if (h.completed || (h.progress_percent || 0) >= 90) existing.completedCount += 1;
      if (isRecent) existing.totalSecondsThisWeek += h.current_time_seconds || 0;
      // latest = first (history ya viene ordenado desc)
      if (new Date(h.created_at) > new Date(existing.latestEntry.created_at)) {
        existing.latestEntry = h;
        existing.latestEpisode = h.episode_number;
      }
      existing.avgProgress = (existing.avgProgress + (h.progress_percent || 0)) / 2;
    }
  }
  return Array.from(map.values());
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
    let q = supabase.from("watch_history").select("*").eq("user_id", user.id);
    q = profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
    const { data } = await q.order("created_at", { ascending: false }).limit(100);
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

  // Set de anime_id que están animando la salida — se ocultan del DOM al terminar.
  const [exiting, setExiting] = useState<Set<number>>(new Set());

  const removeAnime = (anime_id: number) => {
    if (!user) return;
    // Fase 1+2: marcar como saliendo (dispara la animación combinada)
    setExiting((prev) => {
      const next = new Set(prev);
      next.add(anime_id);
      return next;
    });
    // Fase 3: al terminar animación (eject 450ms + collapse 400ms = ~850ms),
    // borrar de estado y de la BD.
    window.setTimeout(async () => {
      let q = supabase.from("watch_history").delete().eq("user_id", user.id).eq("anime_id", anime_id);
      q = profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
      await q;
      setHistory((prev) => prev.filter((h) => h.anime_id !== anime_id));
      setExiting((prev) => {
        const next = new Set(prev);
        next.delete(anime_id);
        return next;
      });
    }, 900);
  };

  const grouped = useMemo(() => groupHistory(history), [history]);
  const hero = grouped[0] || null;
  const rest = grouped.slice(1);
  const topWatched = useMemo(
    () => [...grouped].sort((a, b) => b.episodesCount - a.episodesCount).slice(0, 5),
    [grouped]
  );

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
        <div className="h-[300px] bg-secondary rounded-2xl animate-pulse mb-6" />
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="h-20 bg-secondary rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!hero) {
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

  const heroPct = Math.round(hero.latestEntry.progress_percent || 0);

  return (
    <div className="min-h-screen pt-4 pb-24 px-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-black text-foreground tracking-tight">Tu Dashboard</h1>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition font-medium"
        >
          <Trash2 className="w-4 h-4" /> Limpiar todo
        </button>
      </div>

      {/* ══════════════ HERO: Continuar viendo ══════════════ */}
      <section className="relative w-full h-auto min-h-[400px] md:h-[350px] md:min-h-0 rounded-2xl overflow-hidden border border-border/50 mb-8 group">
        {/* Fondo difuminado */}
        {hero.anime_cover && (
          <img
            src={hero.anime_cover}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
            aria-hidden
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
        <div className="absolute inset-0 backdrop-blur-sm bg-black/40" />

        <div className="relative z-10 h-full flex flex-col md:flex-row items-center gap-4 md:gap-8 p-4 pb-8 md:p-8 md:pb-8">
          {/* Portada */}
          <div className="relative flex-shrink-0 w-[120px] md:w-[180px] aspect-[2/3] rounded-xl overflow-hidden shadow-2xl shadow-primary/30 ring-2 ring-primary/40">
            {hero.anime_cover ? (
              <img src={hero.anime_cover} alt={hero.anime_title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                <Play className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 w-full flex flex-col justify-center items-center text-center md:items-start md:text-left">
            <p className="text-[10px] md:text-xs font-bold text-primary uppercase tracking-[0.2em] mb-1">
              Continuar viendo
            </p>
            <h2 className="text-2xl md:text-4xl font-black text-foreground leading-tight line-clamp-2 md:line-clamp-none mb-2">
              {hero.anime_title}
            </h2>
            <p className="text-sm text-muted-foreground mb-4 hidden md:block">
              Episodio {hero.latestEpisode} · {heroPct}% completado
              {hero.episodesCount > 1 && ` · ${hero.episodesCount} episodios vistos`}
            </p>

            <Link
              to={`/watch/${hero.anime_id}?ep=${hero.latestEpisode}`}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm md:text-base font-bold px-6 py-3 rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.8)] hover:scale-105 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              Retomar Episodio {hero.latestEpisode}
            </Link>

            {/* Barra de progreso */}
            <div className="mt-4 w-full max-w-md mx-auto md:mx-0">
              <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                  style={{ width: `${heroPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>{formatTime(hero.latestEntry.current_time_seconds || 0)}</span>
                <span>{formatTime(hero.latestEntry.total_duration_seconds || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════ GRID ASIMÉTRICO 70/30 ══════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Historial compacto (agrupado) */}
        <section className="lg:col-span-2 min-w-0">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Historial
          </h3>

          {rest.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">
              Solo tienes un anime en tu historial. ¡Sigue explorando!
            </p>
          ) : (
            <div className="space-y-2">
              {rest.map((g) => {
                const pct = Math.round(g.latestEntry.progress_percent || 0);
                const isExiting = exiting.has(g.anime_id);
                return (
                  <div
                    key={g.anime_id}
                    // Wrapper: colapsa altura al final para que la lista suba fluido
                    className={`overflow-hidden transition-all duration-500 ${
                      isExiting ? "animate-row-collapse" : ""
                    }`}
                  >
                    <div
                      // Inner: hace el retroceso + disparo lateral
                      className={`group flex flex-row items-center gap-3 bg-card/50 hover:bg-card p-3 rounded-lg border border-border/40 hover:border-primary/40 transition-colors ${
                        isExiting ? "animate-row-eject pointer-events-none" : ""
                      }`}
                    >
                      <Link
                        to={`/watch/${g.anime_id}?ep=${g.latestEpisode}`}
                        className="flex flex-row items-center gap-3 flex-1 min-w-0"
                      >
                        {/* Thumb cuadrado */}
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-secondary">
                          {g.anime_cover ? (
                            <img src={g.anime_cover} alt={g.anime_title} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Play className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground line-clamp-1">{g.anime_title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Ep. {g.latestEpisode} · {g.episodesCount} vist{g.episodesCount === 1 ? "o" : "os"}
                            {g.completedCount > 0 && ` · ${g.completedCount} ✓`}
                          </p>
                          <div className="mt-1.5 h-1 rounded-full bg-black/40 overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </Link>

                      {/* Play circular */}
                      <Link
                        to={`/watch/${g.anime_id}?ep=${g.latestEpisode}`}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/15 hover:bg-primary/90 hover:text-primary-foreground text-primary flex items-center justify-center transition"
                        aria-label="Continuar"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </Link>

                      <button
                        onClick={() => removeAnime(g.anime_id)}
                        disabled={isExiting}
                        className="flex-shrink-0 w-8 h-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        aria-label="Eliminar"
                      >
                        <Trash2
                          className={`w-3.5 h-3.5 origin-bottom ${
                            isExiting ? "animate-trash-lid-close" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Sidebar: Tu Top */}
        <aside className="lg:col-span-1 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-card/80 to-card/30 p-4">
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Flame className="w-4 h-4 text-primary" /> Tus Más Vistos
            </h3>

            {topWatched.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin datos aún.</p>
            ) : (
              <ol className="space-y-3">
                {topWatched.map((g, i) => {
                  const rank = i + 1;
                  const rankColor =
                    rank === 1
                      ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]"
                      : rank === 2
                      ? "text-yellow-400/90"
                      : rank === 3
                      ? "text-orange-400/80"
                      : "text-muted-foreground";
                  return (
                    <li key={g.anime_id}>
                      <Link
                        to={`/watch/${g.anime_id}?ep=${g.latestEpisode}`}
                        className="group flex items-center gap-3 rounded-lg p-1.5 -m-1.5 hover:bg-card/60 transition"
                      >
                        <span className={`text-3xl font-black leading-none w-8 text-center ${rankColor}`}>
                          {rank}
                        </span>
                        <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-secondary">
                          {g.anime_cover && (
                            <img src={g.anime_cover} alt={g.anime_title} className="w-full h-full object-cover" loading="lazy" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground line-clamp-1 group-hover:text-primary transition">
                            {g.anime_title}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {g.episodesCount} episodio{g.episodesCount !== 1 ? "s" : ""} vist{g.episodesCount === 1 ? "o" : "os"}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
