import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, EyeOff, Eye, Search, Trash2, Bot, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getTrending, getPopular, getRecentlyUpdated, searchAnime, getTitle } from "@/lib/anilist";
import { listHiddenAnimes, hideAnime, unhideAnime, rehideAnime } from "@/lib/hidden-animes";
import { useAuth } from "@/contexts/AuthContext";

export default function HiddenAnimesManager() {
  const { user } = useAuth();
  const [section, setSection] = useState<"recent" | "trending" | "popular" | "search">("recent");
  const [hiddenList, setHiddenList] = useState<any[]>([]);
  const [reload, setReload] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hiddenFilter, setHiddenFilter] = useState<"all" | "hidden" | "visible" | "auto">("all");
  const [hiddenSearch, setHiddenSearch] = useState("");

  useEffect(() => {
    listHiddenAnimes(true).then(setHiddenList);
  }, [reload]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ["admin-hide-search", debounced],
    queryFn: async () => (await searchAnime(debounced, 1, 30)).media,
    enabled: section === "search" && debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sectionData, isLoading } = useQuery({
    queryKey: ["admin-hide-section", section],
    queryFn: async () => {
      if (section === "recent") return (await getRecentlyUpdated(1, 30)).media;
      if (section === "trending") return (await getTrending(1, 30)).media;
      if (section === "popular") return (await getPopular(1, 30)).media;
      return [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: section !== "search",
  });

  const data = section === "search" ? searchResults : sectionData;
  const loading = section === "search" ? searching : isLoading;

  const hiddenIds = useMemo(() => new Set(hiddenList.map((h) => h.anilist_id)), [hiddenList]);
  const publicHiddenIds = useMemo(() => new Set(hiddenList.filter((h) => h.is_hidden !== false).map((h) => h.anilist_id)), [hiddenList]);

  const curatedList = useMemo(() => {
    const q = hiddenSearch.trim().toLowerCase();
    return hiddenList.filter((h) => {
      if (hiddenFilter === "hidden" && h.is_hidden === false) return false;
      if (hiddenFilter === "visible" && h.is_hidden !== false) return false;
      if (hiddenFilter === "auto" && !h.auto_hidden) return false;
      if (!q) return true;
      return String(h.anime_title || h.anilist_id).toLowerCase().includes(q) || String(h.reason || "").toLowerCase().includes(q);
    });
  }, [hiddenList, hiddenFilter, hiddenSearch]);

  const toggle = async (anime: any) => {
    const isHidden = publicHiddenIds.has(anime.id);
    if (isHidden) {
      await unhideAnime(anime.id);
      toast.success("Anime restaurado");
    } else {
      await hideAnime(anime.id, getTitle(anime) || anime.anime_title || "Sin título", user?.id);
      toast.success("Anime eliminado de la página para siempre");
    }
    setReload((n) => n + 1);
  };

  const sections = [
    { key: "recent", label: "🕐 Recientes / Bento" },
    { key: "trending", label: "🔥 Tendencia" },
    { key: "popular", label: "⭐ Populares" },
    { key: "search", label: "🔎 Buscar" },
  ] as const;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-primary" /> Eliminar animes de la página
        </h3>
        <p className="text-[10px] text-muted-foreground mb-3">
          Los animes ocultos desaparecen <b>para siempre</b> de Home, Directorio, Buscador y carruseles.
        </p>

        <div className="flex gap-2 mb-3 flex-wrap">
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                section === s.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {section === "search" && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escribe el nombre del anime a eliminar..."
              className="pl-9 h-9 text-sm"
            />
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : section === "search" && debounced.length < 2 ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">Escribe al menos 2 letras…</p>
        ) : !data?.length ? (
          <p className="text-xs text-muted-foreground italic text-center py-6">Sin resultados</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {data.map((anime: any) => {
              const hidden = hiddenIds.has(anime.id);
              return (
                <div key={anime.id} className={`relative rounded-xl overflow-hidden border-2 ${hidden ? "border-destructive opacity-50" : "border-border"}`}>
                  <img src={anime.coverImage?.large} alt="" className="w-full aspect-[3/4] object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <p className="absolute bottom-1 left-1.5 right-1.5 text-[9px] font-bold text-white line-clamp-2">
                    {getTitle(anime)}
                  </p>
                  <button
                    onClick={() => toggle(anime)}
                    title={hidden ? "Restaurar" : "Eliminar para siempre"}
                    className={`absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
                      hidden ? "bg-destructive text-white" : "bg-black/60 text-primary hover:bg-destructive hover:text-white"
                    }`}
                  >
                    {hidden ? <Eye className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de ocultos */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Animes eliminados ({hiddenList.length})</h3>
        {hiddenList.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">Ninguno eliminado aún</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {hiddenList.map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-border">
                <span className="flex-1 text-xs text-foreground truncate">{h.anime_title || `ID ${h.anilist_id}`}</span>
                <button onClick={() => toggle({ id: h.anilist_id })} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30" title="Restaurar">
                  <Eye className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
