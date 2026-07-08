import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getTrending,
  getTopRated,
  getMovies,
  searchAnime,
  type AniListMedia,
} from "@/lib/anilist";
import { Loader2, SearchX, Film } from "lucide-react";
import AdBannerInline from "@/components/ads/AdBannerInline";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import { usePreferences } from "@/contexts/PreferencesContext";
import HeroCarousel from "@/components/directory/HeroCarousel";
import CatalogDrawer, {
  loadCatalogState,
  THEMED_CATEGORIES,
  type CatalogState,
} from "@/components/directory/CatalogDrawer";
import BentoAnimeCard, { BentoSkeleton } from "@/components/directory/BentoAnimeCard";

const GORE_GENRES = new Set(["Horror", "Ecchi"]);

export default function Directory() {
  const [searchParams] = useSearchParams();
  const genreParam = searchParams.get("genre");

  const [catalog, setCatalog] = useState<CatalogState>(() => loadCatalogState());
  const [moviesMode, setMoviesMode] = useState(false);

  // URL ?genre= → activa la categoría temática que contenga ese género
  useEffect(() => {
    if (!genreParam) return;
    const match = THEMED_CATEGORIES.find((c) => c.genres.includes(genreParam));
    if (match) setCatalog((s) => ({ ...s, categoryKey: match.key }));
  }, [genreParam]);

  const activeCategory = THEMED_CATEGORIES.find((c) => c.key === catalog.categoryKey);
  const activeGenres = activeCategory?.genres || [];

  // Hero: siempre trending para tono aspiracional
  const { data: heroData } = useQuery({
    queryKey: ["directory-hero"],
    queryFn: () => getTrending(1, 8),
    staleTime: 1000 * 60 * 10,
  });

  // Contenido principal
  const mainQuery = useQuery({
    queryKey: ["directory-main", catalog.categoryKey],
    queryFn: () =>
      activeGenres.length > 0
        ? searchAnime("", 1, 40, activeGenres)
        : getTrending(1, 40),
    staleTime: 1000 * 60 * 5,
    enabled: !moviesMode,
  });

  // Películas (infinite)
  const moviesInfinite = useInfiniteQuery({
    queryKey: ["directory-movies-experience"],
    queryFn: ({ pageParam = 1 }) => getMovies(pageParam, 30, null),
    getNextPageParam: (last) =>
      last.pageInfo.hasNextPage ? last.pageInfo.currentPage + 1 : undefined,
    initialPageParam: 1,
    enabled: moviesMode,
    staleTime: 1000 * 60 * 5,
  });

  // Recomendaciones — top rated como base curada
  const { data: recData } = useQuery({
    queryKey: ["directory-recommendations"],
    queryFn: () => getTopRated(1, 12),
    staleTime: 1000 * 60 * 30,
  });

  const { data: hiddenIds } = useQuery({
    queryKey: ["hidden-anime-ids"],
    queryFn: async () => Array.from(await getHiddenAnimeIds()),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);
  const { preferences } = usePreferences();

  const passesFilters = (a: AniListMedia): boolean => {
    if (hiddenSet.has(a.id)) return false;
    if (preferences.hideGore && Array.isArray(a.genres) && a.genres.some((g) => GORE_GENRES.has(g))) return false;
    // Año
    const y = a.seasonYear;
    if (y) {
      if (y < catalog.yearRange[0] || y > catalog.yearRange[1]) return false;
    }
    // Rating
    if (catalog.ratingMin > 0 && (a.averageScore ?? 0) < catalog.ratingMin) return false;
    // Estado
    if (catalog.status !== "ALL" && a.status !== catalog.status) return false;
    return true;
  };

  const raw = moviesMode
    ? moviesInfinite.data?.pages.flatMap((p) => p.media) || []
    : mainQuery.data?.media || [];
  const animes = raw.filter(passesFilters);
  const loading = moviesMode ? moviesInfinite.isLoading : mainQuery.isLoading;

  // Infinite scroll sentinel para películas
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!moviesMode) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && moviesInfinite.hasNextPage && !moviesInfinite.isFetchingNextPage) {
        moviesInfinite.fetchNextPage();
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [moviesMode, moviesInfinite.hasNextPage, moviesInfinite.isFetchingNextPage, moviesInfinite.fetchNextPage]);

  const recommendations = (recData?.media || []).filter((a) => !hiddenSet.has(a.id));

  return (
    <div className="min-h-screen pb-24 -mt-12">
      {/* Hero Carousel (edge-to-edge, quita padding top del layout con -mt-12) */}
      <HeroCarousel items={heroData?.media || []} />

      {/* Drawer flotante */}
      <CatalogDrawer state={catalog} onChange={setCatalog} recommendations={recommendations} />

      {/* Encabezado de sección + toggle Películas */}
      <div className="px-4 md:px-8 mt-8 mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-primary/80">Explora</p>
          <h1 className="directory-hero-title text-3xl md:text-4xl font-bold text-foreground mt-1">
            {moviesMode
              ? "Películas"
              : activeCategory
              ? activeCategory.label
              : "Tendencia curada"}
          </h1>
        </div>
        <button
          onClick={() => setMoviesMode((m) => !m)}
          className={`px-4 py-2 rounded-full text-xs font-semibold inline-flex items-center gap-2 transition-all ${
            moviesMode
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <Film className="w-3.5 h-3.5" /> Películas
        </button>
      </div>

      <div className="px-4 md:px-8">
        <AdBannerInline size="728x90" className="mb-6" />
      </div>

      {/* Bento Grid */}
      <div className="px-4 md:px-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 auto-rows-auto">
            <BentoSkeleton hero />
            {Array(6).fill(0).map((_, i) => <BentoSkeleton key={i} />)}
          </div>
        ) : animes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <SearchX className="w-10 h-10 text-muted" />
            <p className="text-muted-foreground text-sm">No hay resultados con estos filtros.</p>
            <button
              onClick={() => setCatalog(loadCatalogState())}
              className="text-xs text-primary hover:underline"
            >
              Ajustar catálogo
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 animate-fade-in">
            {animes.map((anime, i) => (
              <BentoAnimeCard key={anime.id} anime={anime} hero={i === 0} />
            ))}
          </div>
        )}

        {moviesMode && !loading && (
          <>
            <div ref={sentinelRef} className="h-10" />
            {moviesInfinite.isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            {!moviesInfinite.hasNextPage && animes.length > 0 && (
              <p className="text-center text-[10px] text-muted-foreground py-6">
                No hay más películas
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
