import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { searchAnime } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import AdBannerInline from "@/components/ads/AdBannerInline";
import { Search as SearchIcon, X, Sparkles, TrendingUp, Cog, Settings } from "lucide-react";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";

const SUGGESTIONS = [
  "Naruto",
  "One Piece",
  "Bleach",
  "Attack on Titan",
  "Demon Slayer",
  "Jujutsu Kaisen",
  "My Hero Academia",
  "Chainsaw Man",
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
    const next = [q, ...cur].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

type FilterKey = "ANIME" | "MANGA" | "MOVIE";
const FILTERS: { key: FilterKey; label: string; formats: string[] }[] = [
  { key: "ANIME", label: "Anime", formats: ["TV", "TV_SHORT", "ONA", "OVA", "SPECIAL"] },
  { key: "MANGA", label: "Manga", formats: ["MANGA", "MANHWA", "MANHUA", "NOVEL", "ONE_SHOT"] },
  { key: "MOVIE", label: "Película", formats: ["MOVIE"] },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>(getRecent());
  const [isFocused, setIsFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [lockedFilter, setLockedFilter] = useState<FilterKey | null>(null);
  const [iconSpin, setIconSpin] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus al entrar
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  // Sync URL
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
    }, 400);
    return () => clearTimeout(t);
  }, [query, setSearchParams]);

  const { data, isFetching } = useQuery({
    queryKey: ["search-instant", debouncedQuery],
    queryFn: () => searchAnime(debouncedQuery, 1, 12),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const { data: hiddenIds } = useQuery({
    queryKey: ["hidden-anime-ids"],
    queryFn: async () => Array.from(await getHiddenAnimeIds()),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);
  const allAnimes = (data?.media || []).filter((a) => !hiddenSet.has(a.id));
  const animes = useMemo(() => {
    if (!activeFilter) return allAnimes;
    const allowed = FILTERS.find((f) => f.key === activeFilter)?.formats || [];
    return allAnimes.filter((a) => a.format && allowed.includes(a.format));
  }, [allAnimes, activeFilter]);
  const hasQuery = debouncedQuery.trim().length >= 2;
  const noResults = hasQuery && !isFetching && animes.length === 0;

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

  const handleFilterClick = (key: FilterKey) => {
    setLockedFilter(key);
    setTimeout(() => setLockedFilter(null), 600);
    setActiveFilter((cur) => (cur === key ? null : key));
  };

  const handleIconClick = () => {
    setIconSpin(true);
    setTimeout(() => setIconSpin(false), 500);
    inputRef.current?.focus();
  };

  // Gears animate when focused OR while fetching; reverse-spin briefly on no results
  const gearsActive = isFocused || isFetching;

  return (
    <div className="min-h-screen pb-24 bg-background">
      {/* Header con buscador sticky */}
      <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/40">
        <div className="px-4 pt-5 pb-4 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative">
              <Cog className="w-6 h-6 text-primary animate-spin" style={{ animationDuration: "8s" }} />
              <Cog className="w-3 h-3 text-primary/60 absolute -bottom-0.5 -right-0.5 animate-spin" style={{ animationDuration: "5s", animationDirection: "reverse" }} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground" style={{ fontFamily: "'Cinzel', serif" }}>
              Buscar
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="relative">
            {/* Background mechanical gears */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <Cog
                className={`absolute -left-6 -top-6 w-24 h-24 text-amber-700/20 ${gearsActive ? (noResults ? "steampunk-reverse-brief" : "animate-spin") : ""}`}
                style={gearsActive && !noResults ? { animationDuration: "6s" } : undefined}
              />
              <Cog
                className={`absolute right-10 -top-4 w-16 h-16 text-cyan-500/15 ${gearsActive ? (noResults ? "steampunk-reverse-brief" : "animate-spin") : ""}`}
                style={gearsActive && !noResults ? { animationDuration: "4s", animationDirection: "reverse" } : undefined}
              />
              <Cog
                className={`absolute right-24 -bottom-6 w-20 h-20 text-amber-600/15 ${gearsActive ? (noResults ? "steampunk-reverse-brief" : "animate-spin") : ""}`}
                style={gearsActive && !noResults ? { animationDuration: "9s" } : undefined}
              />
            </div>

            {/* Neon glow */}
            <div
              className={`absolute -inset-0.5 rounded-2xl blur-md transition-opacity duration-500 ${
                noResults
                  ? "opacity-100 bg-gradient-to-r from-amber-600/0 via-red-500/40 to-amber-600/0"
                  : isFocused
                  ? "opacity-100 bg-gradient-to-r from-cyan-400/0 via-cyan-400/50 to-cyan-400/0"
                  : "opacity-0"
              }`}
            />

            <div
              className={`relative flex items-center rounded-2xl transition-all duration-300 border ${
                noResults
                  ? "border-red-500/50 shadow-[0_0_25px_-5px_rgba(239,68,68,0.5)]"
                  : isFocused
                  ? "border-cyan-400/60 shadow-[0_0_30px_-5px_rgba(34,211,238,0.55)]"
                  : "border-amber-900/40"
              }`}
              style={{
                background:
                  "linear-gradient(135deg, rgba(20,18,25,0.95) 0%, rgba(30,25,20,0.9) 50%, rgba(15,15,20,0.95) 100%)",
                boxShadow: "inset 0 1px 0 0 rgba(255,180,80,0.08), inset 0 -1px 0 0 rgba(0,0,0,0.4)",
              }}
            >
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Buscar animes, géneros, estudios..."
                className="flex-1 bg-transparent border-0 outline-none pl-5 pr-3 py-3.5 text-base text-foreground placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
                aria-label="Buscar"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  className="mr-1 p-1.5 rounded-full hover:bg-muted/60 transition-colors"
                  aria-label="Limpiar"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              {/* Golden gear button with cyan crystal */}
              <button
                type="submit"
                onClick={handleIconClick}
                className="mr-2 relative w-11 h-11 rounded-xl flex items-center justify-center group/gear hover:scale-105 active:scale-95 transition-transform"
                aria-label="Buscar"
                style={{
                  background: "radial-gradient(circle at 30% 30%, #d4a24c 0%, #8b5a1c 60%, #3d2810 100%)",
                  boxShadow:
                    "inset 0 1px 2px rgba(255,220,150,0.6), inset 0 -2px 4px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                <Settings
                  className={`w-6 h-6 text-amber-950 drop-shadow-[0_1px_1px_rgba(255,220,150,0.5)] transition-transform duration-500 ${
                    iconSpin ? "rotate-90" : ""
                  } ${isFetching ? "animate-spin" : ""}`}
                  strokeWidth={2.5}
                />
                {/* Cyan crystal core */}
                <span
                  className="absolute w-2 h-2 rounded-full pointer-events-none"
                  style={{
                    background: "radial-gradient(circle, #a5f3fc 0%, #06b6d4 60%, #0e7490 100%)",
                    boxShadow: "0 0 8px 2px rgba(34,211,238,0.8), 0 0 2px rgba(255,255,255,0.9) inset",
                  }}
                />
              </button>
            </div>
          </form>

          {/* Mini-gear filters — appear when focused or query typed */}
          <div
            className={`overflow-hidden transition-all duration-500 ${
              isFocused || hasQuery ? "max-h-20 opacity-100 mt-3" : "max-h-0 opacity-0 mt-0"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap pl-1">
              {FILTERS.map((f) => {
                const isActive = activeFilter === f.key;
                const isLocked = lockedFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleFilterClick(f.key)}
                    className={`group flex items-center gap-1.5 pl-1.5 pr-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all ${
                      isActive
                        ? "bg-cyan-500/15 border-cyan-400/60 text-cyan-200 shadow-[0_0_12px_-2px_rgba(34,211,238,0.55)]"
                        : "bg-secondary/40 border-amber-900/40 text-muted-foreground hover:text-foreground hover:border-amber-700/60"
                    }`}
                    aria-pressed={isActive}
                  >
                    <Cog
                      className={`w-4 h-4 ${isActive ? "text-cyan-300" : "text-amber-600/80"} ${
                        isLocked ? "animate-spin" : isActive ? "animate-spin" : ""
                      }`}
                      style={{ animationDuration: isLocked ? "0.6s" : "5s" }}
                    />
                    {f.label}
                  </button>
                );
              })}
              {activeFilter && (
                <button
                  type="button"
                  onClick={() => setActiveFilter(null)}
                  className="text-[10px] text-muted-foreground hover:text-primary transition-colors ml-1"
                >
                  Quitar filtro
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Estado vacío con sugerencias */}
        {!hasQuery && (
          <div className="space-y-7 animate-in fade-in duration-300">
            {/* Recientes */}
            {recent.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Recientes</h2>
                  </div>
                  <button onClick={clearRecent} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Limpiar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((r) => (
                    <button
                      key={r}
                      onClick={() => handleSuggestion(r)}
                      className="group flex items-center gap-1.5 px-3.5 py-2 bg-secondary/50 hover:bg-primary/15 border border-border/60 hover:border-primary/50 rounded-full text-sm text-foreground transition-all"
                    >
                      <SearchIcon className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      {r}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Populares */}
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Tendencias</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="group relative px-4 py-2 bg-gradient-to-br from-secondary/60 to-secondary/30 hover:from-primary/20 hover:to-primary/5 border border-border/60 hover:border-primary/60 rounded-full text-sm font-medium text-foreground transition-all hover:scale-105 active:scale-95"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>

            {/* Hint visual */}
            <div className="pt-4 flex flex-col items-center text-center gap-3 opacity-70">
              <div className="relative">
                <Cog className="w-12 h-12 text-primary/50 animate-spin" style={{ animationDuration: "12s" }} />
                <SearchIcon className="w-5 h-5 text-primary absolute inset-0 m-auto" />
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Escribe al menos 2 letras para buscar. Para filtros avanzados visita el{" "}
                <button onClick={() => navigate("/directory")} className="text-primary font-semibold hover:underline">
                  Directorio
                </button>.
              </p>
            </div>

            {/* Banner medio: aparece debajo del hint del Directorio.
                Desaparece al teclear (hasQuery) y al final de los resultados se muestra el 160x600. */}
            <div className="pt-2">
              <AdBannerInline size="300x250" className="mx-auto" />
            </div>
          </div>
        )}

        {/* Resultados instantáneos en lista */}
        {hasQuery && (
          <div className="space-y-2 animate-in fade-in duration-200">
            {isFetching && animes.length === 0 && (
              <div className="space-y-2">
                {Array(6).fill(0).map((_, i) => (
                  <div key={i} className="flex gap-3 p-2 rounded-xl bg-secondary/30 animate-pulse">
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
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center animate-in fade-in duration-300">
                <div className="relative">
                  <Cog className="w-16 h-16 text-red-500/40" />
                  <X className="w-6 h-6 text-red-400 absolute inset-0 m-auto" strokeWidth={3} />
                </div>
                <p className="text-foreground font-bold tracking-wide" style={{ fontFamily: "'Cinzel', serif" }}>
                  La maquinaria no encontró registros
                </p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Sin resultados para "<span className="text-red-400/90">{debouncedQuery}</span>". Ajusta los engranajes e intenta otro término.
                </p>
              </div>
            )}

            {animes.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground px-1 pb-1">
                  {animes.length} resultado{animes.length !== 1 ? "s" : ""} para "<span className="text-foreground font-medium">{debouncedQuery}</span>"
                </p>
                <div className="space-y-2">
                  {animes.map((anime, idx) => (
                    <button
                      key={anime.id}
                      onClick={() => navigate(`/anime/${anime.id}`)}
                      className="group w-full flex gap-3 p-2 rounded-xl bg-secondary/30 hover:bg-secondary/70 border border-transparent hover:border-cyan-400/40 transition-all text-left animate-in slide-in-from-top-2 fade-in"
                      style={{ animationDelay: `${Math.min(idx, 8) * 40}ms`, animationDuration: "300ms", animationFillMode: "backwards" }}
                    >
                      <Cog
                        className="w-3.5 h-3.5 text-amber-600/70 self-center flex-shrink-0 animate-spin group-hover:text-cyan-400 transition-colors"
                        style={{ animationDuration: "6s" }}
                      />
                      <div className="relative flex-shrink-0 w-14 h-20 rounded-lg overflow-hidden bg-secondary">
                        <img
                          src={anime.coverImage.large}
                          alt={anime.title.english || anime.title.romaji}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>

                      <div className="flex-1 min-w-0 py-1">
                        <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {anime.title.english || anime.title.romaji}
                        </h3>
                        {anime.title.english && anime.title.romaji !== anime.title.english && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{anime.title.romaji}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {anime.format && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold uppercase">
                              {anime.format}
                            </span>
                          )}
                          {anime.seasonYear && (
                            <span className="text-[10px] text-muted-foreground">{anime.seasonYear}</span>
                          )}
                          {anime.averageScore && (
                            <span className="text-[10px] text-muted-foreground">★ {(anime.averageScore / 10).toFixed(1)}</span>
                          )}
                          {anime.episodes && (
                            <span className="text-[10px] text-muted-foreground">{anime.episodes} eps</span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => navigate(`/directory?q=${encodeURIComponent(debouncedQuery)}`)}
                  className="w-full mt-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/60 text-primary font-semibold text-sm transition-all"
                >
                  Ver todos los resultados en el Directorio →
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
