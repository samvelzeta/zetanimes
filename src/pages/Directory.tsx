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
import { SearchX, Film } from "lucide-react";
import AdBannerInline from "@/components/ads/AdBannerInline";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import { usePreferences } from "@/contexts/PreferencesContext";
import HeaderBento from "@/components/directory/HeaderBento";
import CatalogDrawer, {
  loadCatalogState,
  THEMED_CATEGORIES,
  type CatalogState,
} from "@/components/directory/CatalogDrawer";
import AsymmetricCard, {
  AsymmetricSkeleton,
  type AsymmetricVariant,
} from "@/components/directory/AsymmetricCard";
import StickyRanking from "@/components/directory/StickyRanking";
import ZenLoader from "@/components/directory/ZenLoader";

const GORE_GENRES = new Set(["Horror", "Ecchi"]);

/**
 * Patrón asimétrico repetible (masonry visual):
 *  posiciones dentro del ciclo → variant
 *  ciclo de 7 para romper la simetría y evitar filas iguales
 */
const PATTERN: AsymmetricVariant[] = [
  "landscape", // 1
  "portrait",  // 2
  "portrait",  // 3
  "square",    // 4
  "portrait",  // 5
  "landscape", // 6
  "portrait",  // 7
];
const variantFor = (i: number): AsymmetricVariant => PATTERN[i % PATTERN.length];

export default function Directory() {
  const [searchParams] = useSearchParams();
  const genreParam = searchParams.get("genre");

  const [catalog, setCatalog] = useState<CatalogState>(() => loadCatalogState());
  const [moviesMode, setMoviesMode] = useState(false);

  useEffect(() => {
    if (!genreParam) return;
    const match = THEMED_CATEGORIES.find((c) => c.genres.includes(genreParam));
    if (match) setCatalog((s) => ({ ...s, categoryKey: match.key }));
  }, [genreParam]);

  const activeCategory = THEMED_CATEGORIES.find((c) => c.key === catalog.categoryKey);
  const activeGenres = activeCategory?.genres || [];

  // Header Bento — trending curado
  const { data: heroData } = useQuery({
    queryKey: ["directory-hero"],
    queryFn: () => getTrending(1, 8),
    staleTime: 1000 * 60 * 10,
  });

  // Ranking semanal
  const { data: rankingData } = useQuery({
    queryKey: ["directory-ranking"],
    queryFn: () => getTopRated(1, 12),
    staleTime: 1000 * 60 * 30,
  });

  const mainQuery = useQuery({
    queryKey: ["directory-main", catalog.categoryKey],
    queryFn: () =>
      activeGenres.length > 0
        ? searchAnime("", 1, 40, activeGenres)
        : getTrending(1, 40),
    staleTime: 1000 * 60 * 5,
    enabled: !moviesMode,
  });

  const moviesInfinite = useInfiniteQuery({
    queryKey: ["directory-movies-experience"],
    queryFn: ({ pageParam = 1 }) => getMovies(pageParam, 30, null),
    getNextPageParam: (last) =>
      last.pageInfo.hasNextPage ? last.pageInfo.currentPage + 1 : undefined,
    initialPageParam: 1,
    enabled: moviesMode,
    staleTime: 1000 * 60 * 5,
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
    const y = a.seasonYear;
    if (y) {
      if (y < catalog.yearRange[0] || y > catalog.yearRange[1]) return false;
    }
    if (catalog.ratingMin > 0 && (a.averageScore ?? 0) < catalog.ratingMin) return false;
    if (catalog.status !== "ALL" && a.status !== catalog.status) return false;
    return true;
  };

  const raw = moviesMode
    ? moviesInfinite.data?.pages.flatMap((p) => p.media) || []
    : mainQuery.data?.media || [];
  const animes = raw.filter(passesFilters);
  const loading = moviesMode ? moviesInfinite.isLoading : mainQuery.isLoading;

  // Header — el primero es el "feature del mes"; separamos para que no se dupliquen abajo
  const heroList = (heroData?.media || []).filter((a) => !hiddenSet.has(a.id));
  const feature = heroList[0] || null;
  const primary = heroList[1] || null;
  const bentoQuickRanking = (rankingData?.media || []).filter((a) => !hiddenSet.has(a.id)).slice(0, 3);
  const stickyRanking = (rankingData?.media || []).filter((a) => !hiddenSet.has(a.id));

  const heroIds = new Set([feature?.id, primary?.id].filter(Boolean) as number[]);
  const gridAnimes = animes.filter((a) => !heroIds.has(a.id));

  // Infinite scroll
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

  return (
    <div className="min-h-screen pb-24">
      {/* Header Bento asimétrico (reemplaza el carrusel) */}
      <HeaderBento feature={feature} primary={primary} ranking={bentoQuickRanking} />

      {/* Drawer Catálogo (top-right) */}
      <CatalogDrawer state={catalog} onChange={setCatalog} recommendations={stickyRanking} />

      {/* Encabezado sección + toggle películas */}
      <div className="px-4 md:px-8 mt-10 mb-5 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-[0.4em] uppercase text-primary/80">Explora</p>
          <h1 className="directory-hero-title text-2xl md:text-4xl font-bold text-foreground mt-1">
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

      {/* Layout con sidebar sticky */}
      <div className="px-4 md:px-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Grid asimétrico */}
        <div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <AsymmetricSkeleton key={i} variant={variantFor(i)} />
              ))}
            </div>
          ) : gridAnimes.length === 0 ? (
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 animate-fade-in">
              {gridAnimes.map((anime, i) => (
                <AsymmetricCard key={anime.id} anime={anime} variant={variantFor(i)} />
              ))}
            </div>
          )}

          {moviesMode && !loading && (
            <>
              <div ref={sentinelRef} className="h-10" />
              {moviesInfinite.isFetchingNextPage && (
                <div className="flex justify-center py-6">
                  <ZenLoader size={40} />
                </div>
              )}
              {!moviesInfinite.hasNextPage && gridAnimes.length > 0 && (
                <p className="text-center text-[10px] text-muted-foreground py-6">
                  No hay más películas
                </p>
              )}
            </>
          )}
        </div>

        {/* Sidebar ranking sticky (desktop) */}
        <StickyRanking items={stickyRanking} />
      </div>
    </div>
  );
}
