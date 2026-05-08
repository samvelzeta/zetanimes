import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { searchAnime, getTrending, getRecentlyUpdated, type AniListMedia, getTitle } from "@/lib/anilist";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, Loader2, Check, Download, Clock, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Trash2, Eye, User,
} from "lucide-react";
import { logAdminActivity } from "@/lib/admin-log";
import { useAuth } from "@/contexts/AuthContext";

type TrackerStatus = "waiting" | "downloading" | "completed";

interface TrackerItem {
  id: string;
  anilist_id: number;
  title: string;
  cover_image: string | null;
  total_episodes: number;
  status: TrackerStatus;
  airing_status: string | null;
  genres: string[] | null;
  created_at: string;
  added_by?: string | null;
  updated_by?: string | null;
  episodes?: EpisodeDownload[];
  added_by_name?: string;
}

interface EpisodeDownload {
  id: string;
  tracker_id: string;
  episode_number: number;
  downloaded: boolean;
}

const STATUS_TABS: { key: TrackerStatus; label: string; icon: typeof Clock; color: string }[] = [
  { key: "waiting", label: "En Espera", icon: Clock, color: "text-yellow-400" },
  { key: "downloading", label: "Descargando", icon: Download, color: "text-blue-400" },
  { key: "completed", label: "Completados", icon: CheckCircle2, color: "text-green-400" },
];

export default function DownloadTracker() {
  const [trackers, setTrackers] = useState<TrackerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TrackerStatus>("downloading");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [expandedTracker, setExpandedTracker] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { user } = useAuth();

  const loadTrackers = useCallback(async (statusOverride?: TrackerStatus) => {
    const status = statusOverride || activeStatus;
    setLoading(true);
    const { data } = await supabase
      .from("anime_download_tracker")
      .select("*", { count: "exact" })
      .eq("status", status)
      .order("updated_at", { ascending: false });

    let rows = (data || []) as unknown as TrackerItem[];

    // Resolver nombres de "added_by"
    const ids = Array.from(new Set(rows.map((r) => r.added_by).filter(Boolean) as string[]));
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, username").in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p.display_name || p.username || "Admin"]));
      rows = rows.map((r) => ({ ...r, added_by_name: r.added_by ? map.get(r.added_by) : undefined }));
    }

    if (status === "waiting" && rows.length > 20) {
      const seed = new Date().getHours();
      rows = [...rows].sort((a, b) => ((a.anilist_id * (seed + 1)) % 100) - ((b.anilist_id * (seed + 1)) % 100)).slice(0, 20);
    }
    setTrackers(rows);
    setLoading(false);
  }, [activeStatus]);

  useEffect(() => { loadTrackers(); }, [loadTrackers]);

  const loadEpisodes = async (trackerId: string) => {
    if (expandedTracker === trackerId) {
      setExpandedTracker(null);
      return;
    }
    const { data } = await supabase
      .from("anime_episode_downloads")
      .select("*")
      .eq("tracker_id", trackerId)
      .order("episode_number");

    setTrackers((prev) =>
      prev.map((t) => t.id === trackerId ? { ...t, episodes: (data || []) as unknown as EpisodeDownload[] } : t)
    );
    setExpandedTracker(trackerId);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await searchAnime(searchQuery, 1, 10);
      setSearchResults(res.media);
    } catch {
      toast.error("Error buscando en AniList");
    }
    setSearching(false);
  };

  const addAnime = async (anime: AniListMedia) => {
    // Check if already tracked
    const { data: existing } = await supabase
      .from("anime_download_tracker")
      .select("id")
      .eq("anilist_id", anime.id)
      .limit(1);

    if (existing && existing.length > 0) {
      const trackerId = existing[0].id;
      await supabase.from("anime_download_tracker").update({ status: "downloading" as any }).eq("id", trackerId);
      toast.success("Ya existía: movido a Descargando");
      setActiveStatus("downloading");
      setShowSearch(false);
      await loadTrackers("downloading");
      return;
    }

    const totalEps = anime.episodes || 0;
    const { data: inserted, error } = await supabase.from("anime_download_tracker").insert({
      anilist_id: anime.id,
      title: getTitle(anime),
      cover_image: anime.coverImage?.large || anime.coverImage?.extraLarge,
      total_episodes: totalEps,
      status: "downloading" as any,
      airing_status: anime.status,
      genres: anime.genres,
    }).select().single();

    if (error) {
      toast.error("Error agregando anime");
      return;
    }

    // Create episode entries
    if (inserted && totalEps > 0) {
      const episodes = Array.from({ length: totalEps }, (_, i) => ({
        tracker_id: inserted.id,
        episode_number: i + 1,
        downloaded: false,
      }));
      await supabase.from("anime_episode_downloads").insert(episodes as any);
    }

    toast.success(`${getTitle(anime)} agregado a Descargando`);
    setActiveStatus("downloading");
    setSearchResults([]);
    setSearchQuery("");
    setShowSearch(false);
    if (activeStatus === "downloading") loadTrackers();
  };

  const toggleEpisodeDownloaded = async (trackerId: string, epId: string, current: boolean) => {
    await supabase.from("anime_episode_downloads").update({ downloaded: !current } as any).eq("id", epId);

    setTrackers((prev) =>
      prev.map((t) => {
        if (t.id !== trackerId) return t;
        const eps = t.episodes?.map((e) => e.id === epId ? { ...e, downloaded: !current } : e);
        return { ...t, episodes: eps };
      })
    );

    // Check if all downloaded → auto-complete
    const { data: allEps } = await supabase
      .from("anime_episode_downloads")
      .select("downloaded")
      .eq("tracker_id", trackerId);

    if (allEps) {
      const allDone = allEps.every((e: any) => e.downloaded);
      const anyDone = allEps.some((e: any) => e.downloaded);

      let newStatus: TrackerStatus = "waiting";
      if (allDone) newStatus = "completed";
      else if (anyDone) newStatus = "downloading";

      await supabase.from("anime_download_tracker").update({ status: newStatus as any }).eq("id", trackerId);

      if (allDone && activeStatus !== "completed") {
        toast.success("¡Anime completado! Movido a completados.");
        loadTrackers();
      }
    }
  };

  const changeStatus = async (trackerId: string, newStatus: TrackerStatus) => {
    await supabase.from("anime_download_tracker").update({ status: newStatus as any }).eq("id", trackerId);
    toast.success(`Movido a ${STATUS_TABS.find((s) => s.key === newStatus)?.label}`);
    setActiveStatus(newStatus);
    loadTrackers(newStatus);
  };

  const removeTracker = async (trackerId: string) => {
    const { error } = await (supabase.rpc as any)("delete_download_tracker", { _tracker_id: trackerId });
    if (error) {
      toast.error("No se pudo eliminar del tracker");
      return;
    }
    toast.info("Anime eliminado del tracker");
    loadTrackers();
  };

  const syncTrending = async () => {
    setSyncing(true);
    try {
      const [trending, recent] = await Promise.all([
        getTrending(1, 20),
        getRecentlyUpdated(1, 20),
      ]);
      const all = [...trending.media, ...recent.media];
      const unique = all.filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i);

      let added = 0;
      for (const anime of unique) {
        const { data: exists } = await supabase
          .from("anime_download_tracker")
          .select("id")
          .eq("anilist_id", anime.id)
          .limit(1);

        if (!exists || exists.length === 0) {
          const totalEps = anime.episodes || 0;
          const { data: ins } = await supabase.from("anime_download_tracker").insert({
            anilist_id: anime.id,
            title: getTitle(anime),
            cover_image: anime.coverImage?.large,
            total_episodes: totalEps,
            status: "downloading" as any,
            airing_status: anime.status,
            genres: anime.genres,
          }).select().single();

          if (ins && totalEps > 0) {
            const episodes = Array.from({ length: totalEps }, (_, i) => ({
              tracker_id: ins.id,
              episode_number: i + 1,
              downloaded: false,
            }));
            await supabase.from("anime_episode_downloads").insert(episodes as any);
          }
          added++;
        }
      }
      toast.success(`Sincronizado: ${added} animes nuevos agregados`);
      loadTrackers();
    } catch {
      toast.error("Error al sincronizar con AniList");
    }
    setSyncing(false);
  };

  const filtered = trackers;
  const counts = { waiting: 0, downloading: 0, completed: 0 };

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveStatus(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeStatus === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-muted"
            }`}
          >
            <tab.icon className={`w-3.5 h-3.5 ${activeStatus === tab.key ? "" : tab.color}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex-1 py-2.5 rounded-xl bg-primary/80 text-primary-foreground font-bold text-xs hover:bg-primary transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Agregar Anime
        </button>
        <button
          onClick={syncTrending}
          disabled={syncing}
          className="py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition flex items-center gap-2"
        >
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sync AniList
        </button>
      </div>

      {/* Search panel */}
      {showSearch && (
        <div className="bg-secondary/50 border border-border rounded-xl p-3 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Buscar anime en AniList..."
                className="pl-10 h-10 bg-background border-primary/30 rounded-xl"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-4 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
            </button>
          </div>

          {searchResults.map((anime) => (
            <div key={anime.id} className="flex items-center gap-3 bg-background rounded-lg p-2">
              <img
                src={anime.coverImage?.large}
                alt=""
                className="w-10 h-14 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{getTitle(anime)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {anime.episodes || "?"} eps · {anime.status}
                </p>
              </div>
              <button
                onClick={() => addAnime(anime)}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tracker list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay animes en "{STATUS_TABS.find((s) => s.key === activeStatus)?.label}"
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((tracker) => {
            const downloadedCount = tracker.episodes?.filter((e) => e.downloaded).length || 0;
            const isExpanded = expandedTracker === tracker.id;

            return (
              <div key={tracker.id} className="bg-secondary rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 p-3">
                  {tracker.cover_image && (
                    <img src={tracker.cover_image} alt="" className="w-12 h-16 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{tracker.title}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tracker.total_episodes} eps · {tracker.airing_status || "—"}
                    </p>
                    {tracker.episodes && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${tracker.total_episodes > 0 ? (downloadedCount / tracker.total_episodes) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{downloadedCount}/{tracker.total_episodes}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => loadEpisodes(tracker.id)}
                      className="p-1.5 rounded-lg bg-muted hover:bg-primary/20 transition"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-foreground" /> : <ChevronDown className="w-4 h-4 text-foreground" />}
                    </button>
                    <button
                      onClick={() => removeTracker(tracker.id)}
                      className="p-1.5 rounded-lg hover:bg-destructive/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                </div>

                {/* Expanded episodes */}
                {isExpanded && tracker.episodes && (
                  <div className="border-t border-border p-3">
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                      {tracker.episodes.map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() => toggleEpisodeDownloaded(tracker.id, ep.id, ep.downloaded)}
                          className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${
                            ep.downloaded
                              ? "bg-green-600 text-white"
                              : "bg-muted text-muted-foreground hover:bg-primary/20"
                          }`}
                        >
                          {ep.downloaded && <Check className="w-3 h-3" />}
                          {ep.episode_number}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
