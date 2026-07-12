import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, EyeOff, Eye, Search, Trash2, Bot, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getTrending, getPopular, getRecentlyUpdated, searchAnime, getTitle } from "@/lib/anilist";
import { listHiddenAnimes, hideAnime, unhideAnime, rehideAnime } from "@/lib/hidden-animes";
import { useAuth } from "@/contexts/AuthContext";
import { fuzzyTextScore, normalizeSearchText } from "@/lib/search-utils";

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
    queryFn: async () => (await searchAnime(debounced, 1, 30, [], { skipCuration: true })).media,
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

  const publicHiddenIds = useMemo(() => new Set(hiddenList.filter((h) => h.is_hidden !== false).map((h) => h.anilist_id)), [hiddenList]);

  const curatedList = useMemo(() => {
    const q = normalizeSearchText(hiddenSearch);
    return hiddenList.filter((h) => {
      if (hiddenFilter === "hidden" && h.is_hidden === false) return false;
      if (hiddenFilter === "visible" && h.is_hidden !== false) return false;
      if (hiddenFilter === "auto" && !h.auto_hidden) return false;
      if (!q) return true;
      return fuzzyTextScore(q, [String(h.anime_title || h.anilist_id), String(h.reason || "")]) >= 1.1;
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
              const hidden = publicHiddenIds.has(anime.id);
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" /> Curación ({curatedList.length})
          </h3>
          <div className="flex gap-1">
            {(["all", "hidden", "visible", "auto"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setHiddenFilter(f)}
                className={`rounded-md px-2 py-1 text-[9px] font-bold ${hiddenFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
              >
                {f === "all" ? "Todo" : f === "hidden" ? "Oculto" : f === "visible" ? "Visible" : "Auto"}
              </button>
            ))}
          </div>
        </div>
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={hiddenSearch} onChange={(e) => setHiddenSearch(e.target.value)} placeholder="Buscar ocultos, visibles o auto-filtrados…" className="h-8 pl-8 text-xs" />
        </div>
        {curatedList.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">Sin elementos en esta vista</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {curatedList.map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{h.anime_title || `ID ${h.anilist_id}`}</p>
                  <p className="text-[9px] text-muted-foreground flex items-center gap-1 truncate">
                    {h.auto_hidden && <Bot className="w-3 h-3 text-primary" />}
                    {h.is_hidden === false ? "Visible manual" : "Oculto"}{h.reason ? ` · ${h.reason}` : ""}{h.country_of_origin ? ` · ${h.country_of_origin}` : ""}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (h.is_hidden === false) {
                      await rehideAnime(h.anilist_id);
                      toast.success("Anime ocultado otra vez");
                    } else {
                      await unhideAnime(h.anilist_id);
                      toast.success("Anime marcado como visible");
                    }
                    setReload((n) => n + 1);
                  }}
                  className={`p-1.5 rounded ${h.is_hidden === false ? "bg-destructive/20 text-destructive hover:bg-destructive/30" : "bg-primary/20 text-primary hover:bg-primary/30"}`}
                  title={h.is_hidden === false ? "Ocultar otra vez" : "Marcar visible"}
                >
                  {h.is_hidden === false ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
