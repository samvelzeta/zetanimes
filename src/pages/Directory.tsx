import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { getPopular, getByGenre, getTrending, getTopRated, getThisSeason, getMovies } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import { Filter, X, Tv, SearchX } from "lucide-react";
import AdBannerInline from "@/components/ads/AdBannerInline";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";

const GENRES = ["Acción","Aventura","Comedia","Drama","Fantasía","Horror","Misterio","Romance","Sci-Fi","Slice of Life","Sobrenatural","Sports","Thriller"];
const GENRE_MAP: Record<string, string> = {
  "Acción": "Action", "Aventura": "Adventure", "Comedia": "Comedy", "Drama": "Drama",
  "Fantasía": "Fantasy", "Horror": "Horror", "Misterio": "Mystery", "Romance": "Romance",
  "Sci-Fi": "Sci-Fi", "Slice of Life": "Slice of Life", "Sobrenatural": "Supernatural",
  "Sports": "Sports", "Thriller": "Thriller",
};

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);
const STATUSES = [
  { label: "En emisión", value: "RELEASING" },
  { label: "Finalizado", value: "FINISHED" },
  { label: "Próximamente", value: "NOT_YET_RELEASED" },
];

const QUICK_FILTERS = [
  { key: "trending", label: "🔥 Tendencia" },
  { key: "popular",  label: "⭐ Popular"   },
  { key: "top",      label: "🏆 Top Rating" },
  { key: "season",   label: "🌸 Temporada" },
  { key: "movies",   label: "🎬 Películas" },
];

// Reverse map: English genre -> Spanish label
const REVERSE_GENRE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_MAP).map(([es, en]) => [en, es])
);

export default function Directory() {
  const [searchParams] = useSearchParams();
  const genreParam = searchParams.get("genre");

  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Auto-select genre from URL param
  useEffect(() => {
    if (genreParam) {
      const spanishName = REVERSE_GENRE_MAP[genreParam] || genreParam;
      setSelectedGenre(spanishName);
      setQuickFilter(null);
    }
  }, [genreParam]);

  const { data, isLoading } = useQuery({
    queryKey: ["directory", selectedGenre, selectedYear, selectedStatus, quickFilter],
    queryFn: () => {
      if (quickFilter === "trending") return getTrending(1, 30);
      if (quickFilter === "top") return getTopRated(1, 30);
      if (quickFilter === "season") return getThisSeason(1, 30);
      if (quickFilter === "movies") return getMovies(1, 30);
      if (selectedGenre) return getByGenre(GENRE_MAP[selectedGenre] || selectedGenre, 1, 30);
      return getPopular(1, 30);
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: hiddenIds } = useQuery({
    queryKey: ["hidden-anime-ids"],
    queryFn: async () => Array.from(await getHiddenAnimeIds()),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);
  const animes = (data?.media || []).filter((a) => !hiddenSet.has(a.id));

  const clearFilters = () => {
    setSelectedGenre(null);
    setSelectedYear(null);
    setSelectedStatus(null);
    setQuickFilter(null);
  };

  const hasActiveFilters = selectedGenre || selectedYear || selectedStatus || quickFilter;

  return (
    <div className="min-h-screen pt-4 px-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-black text-foreground tracking-tight">Directorio</h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showFilters ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
        </button>
      </div>

      {/* Quick filters */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3 pb-1">
        <button
          onClick={clearFilters}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!hasActiveFilters ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}
        >
          Todos
        </button>
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setQuickFilter(f.key); setSelectedGenre(null); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${quickFilter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Genre chips */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-3 pb-1">
        {GENRES.map((g) => (
          <button
            key={g}
            onClick={() => { setSelectedGenre(g); setQuickFilter(null); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedGenre === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="bg-secondary/50 border border-border rounded-xl p-3 mb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Filtros Avanzados</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[10px] text-primary flex items-center gap-0.5">
                <X className="w-3 h-3" /> Limpiar
              </button>
            )}
          </div>

          {/* Year */}
          <div>
            <span className="text-[10px] font-medium text-muted-foreground mb-1 block">Año</span>
            <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
              {YEARS.slice(0, 15).map((y) => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(selectedYear === y ? null : y)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${selectedYear === y ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <span className="text-[10px] font-medium text-muted-foreground mb-1 block">Estado</span>
            <div className="flex gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStatus(selectedStatus === s.value ? null : s.value)}
                  className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all flex items-center gap-1 ${selectedStatus === s.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  <Tv className="w-3 h-3" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Banner 728x90 entre filtros y grid de resultados */}
      <AdBannerInline size="728x90" className="mb-4" />

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array(18).fill(0).map((_, i) => (
            <div key={i}>
              <div className="aspect-[3/4] bg-secondary rounded-xl animate-pulse" />
              <div className="h-3 w-20 bg-secondary rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {animes.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} size="grid" showStatus />
          ))}
        </div>
      )}

      {!isLoading && animes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <SearchX className="w-10 h-10 text-muted" />
          <p className="text-muted-foreground text-sm">No encontramos resultados.</p>
        </div>
      )}
    </div>
  );
}
