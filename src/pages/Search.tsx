import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { searchAnime, getTrending } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import AdBannerInline from "@/components/ads/AdBannerInline";
import {
  Search as SearchIcon,
  X,
  Clock,
  Flame,
  SlidersHorizontal,
  ArrowUpRight,
  Sparkles,
  Cog,
  Settings,
} from "lucide-react";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import { getAnimeIdsWithSeekeMaster } from "@/lib/anime-prequels";

const SUGGESTIONS = [
  "Naruto",
  "One Piece",
  "Bleach",
  "Attack on Titan",
  "Demon Slayer",
  "Jujutsu Kaisen",
  "My Hero Academia",
  "Chainsaw Man",
  "Solo Leveling",
  "Frieren",
];

type FilterKey = "ALL" | "SERIES" | "MOVIE" | "ONGOING";
const FILTERS: { key: FilterKey; label: string; formats: string[] | null; status?: string }[] = [
  { key: "ALL", label: "Todo", formats: null },
  { key: "SERIES", label: "Series", formats: ["TV", "TV_SHORT", "ONA", "OVA", "SPECIAL"] },
  { key: "MOVIE", label: "Películas", formats: ["MOVIE"] },
  { key: "ONGOING", label: "En emisión", formats: null, status: "RELEASING" },
];


const RECENT_KEY = "zet:recent-searches";

function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function pushRecent(q: string) {
  if (!q.trim()) return;
  try {
    const cur = getRecent().filter((x) => x.toLowerCase() !== q.toLowerCase());
    const next = [q, ...cur].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>(getRecent());
  const [activeFilter, setActiveFilter] = useState<FilterKey>("ALL");
  const [isFocused, setIsFocused] = useState(false);
  const [iconSpin, setIconSpin] = useState(false);
  const [lockedFilter, setLockedFilter] = useState<FilterKey | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q !== query) {
      setQuery(q);
      setDebouncedQuery(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      if (query.trim()) {
        setSearchParams({ q: query.trim() }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, setSearchParams]);

  const { data, isFetching } = useQuery({
    queryKey: ["search-instant", debouncedQuery],
    queryFn: () => searchAnime(debouncedQuery, 1, 18, [], { includeAdult: true }),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: trending } = useQuery({
    queryKey: ["search-trending-preview"],
    queryFn: () => getTrending(1, 8),
    staleTime: 30 * 60 * 1000,
  });

  const { data: hiddenIds } = useQuery({
    queryKey: ["hidden-anime-ids"],
    queryFn: async () => Array.from(await getHiddenAnimeIds()),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);

  // Los títulos marcados isAdult solo son visibles en búsqueda si ya tienen enlace madre Seeke guardado.
  const { data: seekeIds } = useQuery({
    queryKey: ["search-seeke-master-ids"],
    queryFn: async () => Array.from(await getAnimeIdsWithSeekeMaster()),
    staleTime: 1000 * 60 * 5,
  });
  const seekeSet = useMemo(() => new Set<number>(seekeIds || []), [seekeIds]);

  const allAnimes = (data?.media || []).filter(
    (a) => !hiddenSet.has(a.id) && (!(a as any).isAdult || seekeSet.has(a.id)),
  );
  const animes = useMemo(() => {
    const filter = FILTERS.find((f) => f.key === activeFilter);
    if (!filter) return allAnimes;
    let list = allAnimes;
    if (filter.formats) list = list.filter((a) => a.format && filter.formats!.includes(a.format));
    if (filter.status) list = list.filter((a) => (a as any).status === filter.status);
    return list;
  }, [allAnimes, activeFilter]);

  const trendingList = (trending?.media || []).filter((a) => !hiddenSet.has(a.id)).slice(0, 6);
  const hasQuery = debouncedQuery.trim().length >= 2;

  const handleSuggestion = (s: string) => {
    setQuery(s);
    pushRecent(s);
    setRecent(getRecent());
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      pushRecent(query.trim());
      setRecent(getRecent());
    }
  };

  const clearRecent = () => {
    localStorage.removeItem(RECENT_KEY);
    setRecent([]);
  };

  const removeRecent = (r: string) => {
    const next = getRecent().filter((x) => x !== r);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setRecent(next);
  };

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Sticky glassmorphism header — mismo lenguaje visual que Home/Directory */}
      <div className="sticky top-0 z-30 bg-background/70 backdrop-blur-2xl border-b border-border/40">
        <div className="px-4 pt-5 pb-4 max-w-5xl mx-auto">
          <div className="flex items-baseline justify-between mb-4">
            <h1
              className="text-2xl md:text-3xl font-black tracking-tight text-foreground"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Buscar
            </h1>
            {hasQuery && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {isFetching ? "buscando…" : `${animes.length} resultado${animes.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute -inset-px rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 blur-md" />

            <div className="relative flex items-center gap-2 rounded-2xl bg-secondary/40 border border-border/60 group-focus-within:border-primary/60 transition-colors overflow-hidden">
              {/* Engranajes decorativos integrados en el fondo */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <Cog
                  className={`absolute -left-4 -top-5 w-20 h-20 text-primary/[0.08] ${
                    isFocused || isFetching ? "animate-spin" : ""
                  }`}
                  style={{ animationDuration: "8s" }}
                />
                <Cog
                  className={`absolute right-20 -bottom-6 w-16 h-16 text-primary/[0.07] ${
                    isFocused || isFetching ? "animate-spin" : ""
                  }`}
                  style={{ animationDuration: "5s", animationDirection: "reverse" }}
                />
                <Cog
                  className={`absolute right-40 -top-3 w-10 h-10 text-primary/[0.06] ${
                    isFocused || isFetching ? "animate-spin" : ""
                  }`}
                  style={{ animationDuration: "10s" }}
                />
              </div>

              <SearchIcon
                className={`relative w-5 h-5 ml-4 shrink-0 transition-colors ${
                  isFetching ? "text-primary animate-pulse" : "text-muted-foreground group-focus-within:text-primary"
                }`}
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Título, género, estudio, personaje…"
                className="relative flex-1 min-w-0 bg-transparent border-0 outline-none py-3.5 text-base text-foreground placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
                aria-label="Buscar"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  className="relative mr-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors"
                  aria-label="Limpiar"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <kbd className="relative hidden md:inline-flex items-center gap-1 mr-2 text-[10px] font-mono text-muted-foreground/70 border border-border/60 rounded-md px-1.5 py-0.5">
                ⏎
              </kbd>
              {/* Engranaje dorado con cristal cian — botón submit */}
              <button
                type="submit"
                onClick={() => {
                  setIconSpin(true);
                  setTimeout(() => setIconSpin(false), 500);
                  inputRef.current?.focus();
                }}
                aria-label="Buscar"
                className="relative mr-2 w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                style={{
                  background: "radial-gradient(circle at 30% 30%, #d4a24c 0%, #8b5a1c 60%, #3d2810 100%)",
                  boxShadow:
                    "inset 0 1px 2px rgba(255,220,150,0.55), inset 0 -2px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.35)",
                }}
              >
                <Settings
                  className={`w-5 h-5 text-amber-950 transition-transform duration-500 ${iconSpin ? "rotate-90" : ""} ${isFetching ? "animate-spin" : ""}`}
                  strokeWidth={2.5}
                />
                <span
                  className="absolute w-1.5 h-1.5 rounded-full pointer-events-none"
                  style={{
                    background: "radial-gradient(circle, #a5f3fc 0%, #06b6d4 60%, #0e7490 100%)",
                    boxShadow: "0 0 6px 2px rgba(34,211,238,0.75)",
                  }}
                />
              </button>
            </div>
          </form>

          {/* Filtros chip con mini engranaje */}
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mr-1" />
            {FILTERS.map((f) => {
              const active = activeFilter === f.key;
              const locked = lockedFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setLockedFilter(f.key);
                    setTimeout(() => setLockedFilter(null), 600);
                    setActiveFilter(f.key);
                  }}
                  className={`shrink-0 flex items-center gap-1.5 pl-2 pr-3 py-1 rounded-full text-xs font-medium tracking-wide transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]"
                      : "bg-secondary/50 text-muted-foreground hover:text-foreground border border-border/50"
                  }`}
                  aria-pressed={active}
                >
                  <Cog
                    className={`w-3 h-3 ${active ? "text-primary-foreground" : "text-muted-foreground/70"} ${
                      locked ? "animate-spin" : active ? "animate-spin" : ""
                    }`}
                    style={{ animationDuration: locked ? "0.6s" : "6s" }}
                  />
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>


      <div className="max-w-5xl mx-auto px-4 pt-6">
        {/* Empty state — bento minimal con recientes, sugerencias y tendencia */}
        {!hasQuery && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Recientes */}
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 px-0.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em]">Recientes</h2>
                  </div>
                  <button
                    onClick={clearRecent}
                    className="text-[11px] text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    Limpiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <div
                      key={r}
                      className="group inline-flex items-center rounded-full bg-secondary/40 border border-border/50 hover:border-primary/50 transition-all"
                    >
                      <button
                        onClick={() => handleSuggestion(r)}
                        className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-sm text-foreground/90 group-hover:text-primary transition-colors"
                      >
                        <Clock className="w-3 h-3 text-muted-foreground/60" />
                        {r}
                      </button>
                      <button
                        onClick={() => removeRecent(r)}
                        className="pr-2 py-1.5 text-muted-foreground/50 hover:text-primary transition-colors"
                        aria-label={`Quitar ${r}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Sugerencias populares */}
            <section>
              <div className="flex items-center gap-2 mb-3 px-0.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em]">Sugerencias</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="px-3.5 py-1.5 rounded-full text-sm font-medium bg-secondary/30 border border-border/50 text-foreground/80 hover:text-primary hover:border-primary/60 hover:bg-primary/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Tendencia — bento visual, mismo lenguaje que Home */}
            {trendingList.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 px-0.5">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-primary" />
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-[0.15em]">Tendencia ahora</h2>
                  </div>
                  <button
                    onClick={() => navigate("/directory")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    Directorio <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {trendingList.map((anime) => (
                    <div key={anime.id} className="animate-in fade-in duration-500">
                      <AnimeCard anime={anime} size="grid" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <div className="pt-2">
              <AdBannerInline size="300x250" className="mx-auto" />
            </div>
          </div>
        )}

        {/* Resultados */}
        {hasQuery && (
          <div className="animate-in fade-in duration-200">
            {isFetching && animes.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2.5 rounded-2xl bg-secondary/30 animate-pulse">
                    <div className="w-14 h-20 rounded-lg bg-secondary" />
                    <div className="flex-1 py-2 space-y-2">
                      <div className="h-4 w-3/4 bg-secondary rounded" />
                      <div className="h-3 w-1/2 bg-secondary rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isFetching && animes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-2xl bg-secondary/40 border border-border/50 flex items-center justify-center">
                  <SearchIcon className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p
                  className="text-foreground font-bold text-lg tracking-tight"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  Sin resultados
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  No encontramos coincidencias para{" "}
                  <span className="text-primary font-medium">"{debouncedQuery}"</span>
                  {activeFilter !== "ALL" && (
                    <> con el filtro <span className="text-foreground">{FILTERS.find((f) => f.key === activeFilter)?.label}</span></>
                  )}.
                </p>
                {activeFilter !== "ALL" && (
                  <button
                    onClick={() => setActiveFilter("ALL")}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Quitar filtro y ver todo
                  </button>
                )}
              </div>
            )}

            {animes.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {animes.map((anime, idx) => (
                    <button
                      key={anime.id}
                      onClick={() => navigate(`/anime/${anime.id}`)}
                      className="group relative flex gap-3 p-2.5 rounded-2xl bg-secondary/25 hover:bg-secondary/60 border border-border/40 hover:border-primary/50 transition-all text-left animate-in fade-in slide-in-from-top-1"
                      style={{
                        animationDelay: `${Math.min(idx, 10) * 30}ms`,
                        animationDuration: "300ms",
                        animationFillMode: "backwards",
                      }}
                    >
                      <div className="relative flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-secondary">
                        <img
                          src={anime.coverImage.large}
                          alt={anime.title.english || anime.title.romaji}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0 py-0.5 pr-1">
                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {anime.title.english || anime.title.romaji}
                        </h3>
                        {anime.title.english && anime.title.romaji !== anime.title.english && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {anime.title.romaji}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {anime.format && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold uppercase tracking-wider">
                              {anime.format}
                            </span>
                          )}
                          {anime.seasonYear && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {anime.seasonYear}
                            </span>
                          )}
                          {anime.averageScore && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              ★ {(anime.averageScore / 10).toFixed(1)}
                            </span>
                          )}
                          {anime.episodes && (
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {anime.episodes} eps
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary self-center opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => navigate(`/directory?q=${encodeURIComponent(debouncedQuery)}`)}
                  className="w-full mt-5 py-3 rounded-2xl bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/60 text-primary font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  Ver todos en el Directorio <ArrowUpRight className="w-4 h-4" />
                </button>

                <AdBannerInline size="160x600" className="mt-5 mb-2" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
