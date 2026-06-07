import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, RefreshCcw, Trash2, Tv } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAnime, getTitle, getStatusLabel, type AniListMedia } from "@/lib/anilist";
import {
  deleteAnimeStatusOverride,
  listAnimeStatusOverrides,
  upsertAnimeStatusOverride,
  type AnimeStatus,
  type AnimeStatusOverride,
} from "@/lib/anime-status-overrides";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STATUSES: AnimeStatus[] = ["RELEASING", "FINISHED", "NOT_YET_RELEASED", "HIATUS", "CANCELLED"];

export default function AnimeStatusOverridesAdmin() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState<AnimeStatusOverride[]>([]);
  const [savingId, setSavingId] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const loadOverrides = async () => setOverrides(await listAnimeStatusOverrides());
  useEffect(() => { loadOverrides(); }, []);

  const byAnime = useMemo(() => new Map(overrides.map((item) => [item.anilist_id, item])), [overrides]);

  const runSearch = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchAnime(value, 1, 12);
        setResults(res.media || []);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 350);
  };

  const saveStatus = async (anime: AniListMedia, status: AnimeStatus) => {
    setSavingId(anime.id);
    const res = await upsertAnimeStatusOverride({
      anilist_id: anime.id,
      anime_title: getTitle(anime),
      cover_image: anime.coverImage?.large || anime.coverImage?.extraLarge || null,
      manual_status: status,
      created_by: user?.id ?? null,
    });
    setSavingId(null);
    if (!res.success) return toast.error(res.error || "No se pudo guardar");
    toast.success(`Estado cambiado a ${getStatusLabel(status)}`);
    await loadOverrides();
  };

  const removeStatus = async (anilistId: number) => {
    const res = await deleteAnimeStatusOverride(anilistId);
    if (!res.success) return toast.error(res.error || "No se pudo quitar");
    toast.success("Estado manual quitado");
    await loadOverrides();
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Tv className="w-4 h-4 text-primary" /> Estados manuales de anime
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          Corrige animes que AniList mantiene en próximo, emisión o finalizado incorrectamente.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => runSearch(e.target.value)} placeholder="Buscar anime para cambiar estado…" className="h-10 pl-10 bg-secondary border-primary/30 rounded-xl" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />}
      </div>

      {results.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {results.map((anime) => {
            const active = byAnime.get(anime.id)?.manual_status || anime.status;
            return (
              <div key={anime.id} className="rounded-xl border border-border bg-secondary p-2">
                <div className="flex gap-2">
                  <img src={anime.coverImage?.large || ""} alt="" className="h-16 w-11 rounded object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{getTitle(anime)}</p>
                    <p className="text-[10px] text-muted-foreground">AniList: {getStatusLabel(anime.status)} · Manual: {byAnime.has(anime.id) ? getStatusLabel(active as AnimeStatus) : "—"}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {STATUSES.map((status) => (
                        <button key={status} onClick={() => saveStatus(anime, status)} disabled={savingId === anime.id} className={`rounded-md px-2 py-1 text-[9px] font-bold transition ${active === status ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                          {getStatusLabel(status)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold text-foreground">Correcciones activas ({overrides.length})</h4>
          <button onClick={loadOverrides} className="rounded-lg bg-secondary p-1.5 text-muted-foreground hover:text-primary"><RefreshCcw className="h-3.5 w-3.5" /></button>
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {overrides.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No hay estados manuales.</p> : overrides.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-2">
              {item.cover_image && <img src={item.cover_image} alt="" className="h-10 w-7 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground">{item.anime_title || `ID ${item.anilist_id}`}</p>
                <p className="text-[10px] text-primary">{getStatusLabel(item.manual_status)}</p>
              </div>
              <button onClick={() => removeStatus(item.anilist_id)} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="Quitar estado manual">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}