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

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);
  const [recent, setRecent] = useState<string[]>(getRecent());
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
  const animes = (data?.media || []).filter((a) => !hiddenSet.has(a.id));
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

          <form onSubmit={handleSubmit} className="relative group">
            {/* Glow steampunk */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 rounded-2xl opacity-0 group-focus-within:opacity-100 blur-md transition-opacity duration-500" />
            
            <div className="relative flex items-center bg-secondary/60 border border-border/60 group-focus-within:border-primary/60 rounded-2xl transition-colors">
              <SearchIcon className={`w-5 h-5 ml-4 transition-colors ${isFetching ? "text-primary animate-pulse" : "text-muted-foreground group-focus-within:text-primary"}`} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar animes, géneros, estudios..."
                className="flex-1 bg-transparent border-0 outline-none px-3 py-3.5 text-base text-foreground placeholder:text-muted-foreground/60"
                autoComplete="off"
                spellCheck={false}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  className="mr-3 p-1.5 rounded-full hover:bg-muted/60 transition-colors"
                  aria-label="Limpiar"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </form>
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
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <SearchIcon className="w-12 h-12 text-muted-foreground/40" />
                <p className="text-foreground font-semibold">Sin resultados</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  No encontramos "<span className="text-primary">{debouncedQuery}</span>". Probá con otro nombre.
                </p>
              </div>
            )}

            {animes.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground px-1 pb-1">
                  {animes.length} resultado{animes.length !== 1 ? "s" : ""} para "<span className="text-foreground font-medium">{debouncedQuery}</span>"
                </p>
                <div className="space-y-2">
                  {animes.map((anime) => (
                    <button
                      key={anime.id}
                      onClick={() => navigate(`/anime/${anime.id}`)}
                      className="group w-full flex gap-3 p-2 rounded-xl bg-secondary/30 hover:bg-secondary/70 border border-transparent hover:border-primary/40 transition-all text-left"
                    >
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
