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
import HeroCarousel from "@/components/directory/HeroCarousel";
import CatalogDrawer, {
  loadCatalogState,
  THEMED_CATEGORIES,
  type CatalogState,
} from "@/components/directory/CatalogDrawer";
import AsymmetricCard, {
  AsymmetricSkeleton,
  type AsymmetricVariant,
} from "@/components/directory/AsymmetricCard";
import StoryCard from "@/components/directory/StoryCard";
import CinemaSection from "@/components/directory/CinemaSection";
import StickyRanking from "@/components/directory/StickyRanking";
import ZenLoader from "@/components/directory/ZenLoader";

const GORE_GENRES = new Set(["Horror", "Ecchi"]);

const PATTERN: AsymmetricVariant[] = [
  "landscape",
  "portrait",
  "portrait",
  "square",
  "portrait",
  "landscape",
  "portrait",
];
const variantFor = (i: number): AsymmetricVariant => PATTERN[i % PATTERN.length];

// Cada 5 posiciones inserta un "Perfil de intriga"
const STORY_EVERY = 5;

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

  const { data: heroData } = useQuery({
    queryKey: ["directory-hero"],
    queryFn: () => getTrending(1, 8),
    staleTime: 1000 * 60 * 10,
  });

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

  // Cine ZetAnime — cargar sólo cuando NO estamos en modo películas
  const cinemaQuery = useQuery({
    queryKey: ["directory-cinema"],
    queryFn: () => getMovies(1, 14, null),
    staleTime: 1000 * 60 * 15,
    enabled: !moviesMode,
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

  const heroList = (heroData?.media || []).filter((a) => !hiddenSet.has(a.id));
  const rankingList = (rankingData?.media || []).filter((a) => !hiddenSet.has(a.id));
  const cinemaList = (cinemaQuery.data?.media || []).filter((a) => !hiddenSet.has(a.id));

  // Seleccionar candidatos para StoryCard (mayor score)
  const storyPool = useMemo(
    () =>
      [...animes]
        .filter((a) => (a.averageScore ?? 0) >= 75 && (a.description || "").length > 80)
        .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)),
    [animes]
  );

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

  // Construir grid con StoryCards intercaladas
  const usedStoryIds = new Set<number>();
  const gridNodes: React.ReactNode[] = [];
  let visualIndex = 0;
  animes.forEach((anime, i) => {
    gridNodes.push(
      <AsymmetricCard key={`a-${anime.id}`} anime={anime} variant={variantFor(visualIndex)} />
    );
    visualIndex++;
    if ((i + 1) % STORY_EVERY === 0) {
      const pick = storyPool.find((s) => !usedStoryIds.has(s.id) && s.id !== anime.id);
      if (pick) {
        usedStoryIds.add(pick.id);
        gridNodes.push(
          <StoryCard key={`s-${pick.id}`} anime={pick} index={Math.floor(i / STORY_EVERY)} />
        );
      }
    }
  });

  return (
    <div className="min-h-screen pb-24 -mt-12">
      {/* Hero carousel editorial */}
      <HeroCarousel items={heroList} />

      {/* Subtítulo móvil estático */}
      <div className="md:hidden px-5 mt-4 mb-1 text-center">
        <p className="directory-hero-title text-sm text-foreground/80 italic">
          El inicio de una nueva leyenda
        </p>
      </div>

      {/* Drawer Catálogo */}
      <CatalogDrawer state={catalog} onChange={setCatalog} recommendations={rankingList} />

      {/* Encabezado + toggle películas */}
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

      <div className="px-4 md:px-8 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <AsymmetricSkeleton key={i} variant={variantFor(i)} />
              ))}
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 animate-fade-in">
              {gridNodes}
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
              {!moviesInfinite.hasNextPage && animes.length > 0 && (
                <p className="text-center text-[10px] text-muted-foreground py-6">
                  No hay más películas
                </p>
              )}
            </>
          )}
        </div>

        {/* Ranking sticky (desktop) */}
        <StickyRanking items={rankingList} />
      </div>

      {/* Cine ZetAnime — sólo fuera de moviesMode */}
      {!moviesMode && (
        <CinemaSection items={cinemaList} loading={cinemaQuery.isLoading} />
      )}

      {/* Ranking móvil al final */}
      {rankingList.length > 0 && (
        <section className="lg:hidden px-4 md:px-8 mt-10">
          <p className="text-[10px] tracking-[0.4em] uppercase text-primary/80">Ranking</p>
          <h2 className="directory-hero-title text-xl font-bold text-foreground mt-1 mb-4">
            Top semanal
          </h2>
          <ol className="space-y-2">
            {rankingList.slice(0, 10).map((a, i) => (
              <li
                key={a.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-secondary/40 border border-primary/10"
              >
                <span
                  className={`directory-hero-title text-lg font-bold w-6 text-center ${
                    i < 3 ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <p className="text-sm text-foreground font-medium line-clamp-1 flex-1">
                  {a.title.english || a.title.romaji}
                </p>
                {a.averageScore && (
                  <span className="text-xs text-primary font-mono">
                    ★ {(a.averageScore / 10).toFixed(1)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
