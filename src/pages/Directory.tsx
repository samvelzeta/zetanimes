import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  getTrending,
  getTopRated,
  getMovies,
  getUpcomingMovies,
  searchAnime,
  type AniListMedia,
} from "@/lib/anilist";

import { SearchX } from "lucide-react";
import AdBannerInline from "@/components/ads/AdBannerInline";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import { usePreferences } from "@/contexts/PreferencesContext";
import FilmstripShowcase from "@/components/directory/FilmstripShowcase";
import CinemaExtras from "@/components/directory/CinemaExtras";
import CatalogDrawer, {
  loadCatalogState,
  THEMED_CATEGORIES,
  type CatalogState,
} from "@/components/directory/CatalogDrawer";
import DynamicBlock, { DynamicBlockSkeleton } from "@/components/directory/DynamicBlock";
import StoryCard from "@/components/directory/StoryCard";
import CharacterCard from "@/components/directory/CharacterCard";
import CharacterStats from "@/components/directory/CharacterStats";
import CinemaAccordion from "@/components/directory/CinemaAccordion";
import StickyRanking from "@/components/directory/StickyRanking";
import { getPopularCharacters } from "@/lib/anilist-characters";
import { getAnimeIdsWithSeekeMaster } from "@/lib/anime-prequels";


const GORE_GENRES = new Set(["Horror", "Ecchi"]);
const STORY_EVERY = 6; // intercala una Crónica cada 6 bloques

export default function Directory() {
  const [searchParams] = useSearchParams();
  const genreParam = searchParams.get("genre");

  const [catalog, setCatalog] = useState<CatalogState>(() => loadCatalogState());

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
  });

  const cinemaQuery = useQuery({
    queryKey: ["directory-cinema"],
    queryFn: () => getMovies(1, 14, null),
    staleTime: 1000 * 60 * 15,
  });

  const upcomingMoviesQuery = useQuery({
    queryKey: ["directory-upcoming-movies"],
    queryFn: () => getUpcomingMovies(1, 20),
    staleTime: 1000 * 60 * 60,
  });


  const charactersQuery = useQuery({
    queryKey: ["directory-characters"],
    queryFn: () => getPopularCharacters(1, 25),
    staleTime: 1000 * 60 * 60,
  });


  const { data: hiddenIds } = useQuery({
    queryKey: ["hidden-anime-ids"],
    queryFn: async () => Array.from(await getHiddenAnimeIds()),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);

  // Ids con enlace madre Seeke — las películas SIN este enlace se ocultan del directorio
  // (deben pasar por "Pendientes de aprobación" primero).
  const { data: seekeMasterSet } = useQuery({
    queryKey: ["directory-seeke-master-ids"],
    queryFn: () => getAnimeIdsWithSeekeMaster(),
    staleTime: 1000 * 60 * 5,
  });

  const { preferences } = usePreferences();

  const isMovie = (a: AniListMedia) => a.format === "MOVIE";
  const movieHasSeeke = (a: AniListMedia) => !!seekeMasterSet && seekeMasterSet.has(a.id);

  const passesFilters = (a: AniListMedia): boolean => {
    if (hiddenSet.has(a.id)) return false;
    if (preferences.hideGore && Array.isArray(a.genres) && a.genres.some((g) => GORE_GENRES.has(g))) return false;
    // Películas sin enlace madre Seeke → se ocultan (van a Pendientes)
    if (isMovie(a) && !movieHasSeeke(a)) return false;
    const y = a.seasonYear;
    if (y && (y < catalog.yearRange[0] || y > catalog.yearRange[1])) return false;
    if (catalog.ratingMin > 0 && (a.averageScore ?? 0) < catalog.ratingMin) return false;
    if (catalog.status !== "ALL" && a.status !== catalog.status) return false;
    return true;
  };

  const animes = (mainQuery.data?.media || []).filter(passesFilters);
  const loading = mainQuery.isLoading;

  const heroList = (heroData?.media || []).filter((a) => !hiddenSet.has(a.id) && (!isMovie(a) || movieHasSeeke(a)));
  const rankingList = (rankingData?.media || []).filter((a) => !hiddenSet.has(a.id) && (!isMovie(a) || movieHasSeeke(a)));
  const cinemaList = (cinemaQuery.data?.media || []).filter((a) => !hiddenSet.has(a.id) && movieHasSeeke(a));

  // Reutiliza los mismos datos ya cargados (sin llamadas extra)
  const storyPool = useMemo(
    () =>
      [...animes]
        .filter((a) => (a.averageScore ?? 0) >= 75 && (a.description || "").length > 120)
        .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)),
    [animes]
  );

  // Construye la secuencia masonry con Crónicas + Personajes intercalados
  const characters = charactersQuery.data || [];
  const usedStoryIds = new Set<number>();
  const usedCharIds = new Set<number>();
  const blocks: React.ReactNode[] = [];
  let charCursor = 0;
  animes.forEach((a, i) => {
    const feature = (a.averageScore ?? 0) >= 85 || i % 11 === 0;
    blocks.push(<DynamicBlock key={`b-${a.id}`} anime={a} feature={feature} />);
    if ((i + 1) % STORY_EVERY === 0) {
      const pick = storyPool.find((s) => !usedStoryIds.has(s.id) && s.id !== a.id);
      if (pick) {
        usedStoryIds.add(pick.id);
        blocks.push(
          <StoryCard key={`s-${pick.id}`} anime={pick} index={Math.floor(i / STORY_EVERY)} />
        );
      }
    }
    // Personaje cada 4 bloques (desfasado del ciclo de Crónicas)
    if ((i + 1) % 4 === 0 && charCursor < characters.length) {
      const ch = characters.find((c) => !usedCharIds.has(c.id));
      if (ch) {
        usedCharIds.add(ch.id);
        charCursor++;
        blocks.push(<CharacterCard key={`c-${ch.id}`} character={ch} index={charCursor} />);
      }
    }
  });

  return (
    <div className="min-h-screen pb-24 -mt-12">
      <FilmstripShowcase items={heroList} />


      {/* Subtítulo móvil */}
      <div className="md:hidden px-5 mt-4 mb-1 text-center">
        <p className="directory-hero-title text-sm text-foreground/80 italic">
          El inicio de una nueva leyenda
        </p>
      </div>

      <CatalogDrawer state={catalog} onChange={setCatalog} recommendations={rankingList} />

      {/* Encabezado sutil de sección */}
      <header className="px-4 md:px-8 mt-10 mb-6">
        <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Editorial</p>
        <h1 className="directory-hero-title text-2xl md:text-4xl font-bold text-foreground mt-1">
          {activeCategory ? activeCategory.label : "Selecciones de la semana"}
        </h1>
        <div className="mt-3 h-px w-16 bg-primary/40" />
      </header>

      <div className="px-4 md:px-8">
        <AdBannerInline size="728x90" className="mb-6" />
      </div>

      <div className="px-4 md:px-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_260px] gap-6">
        <div className="min-w-0">

          {loading ? (
            <div className="columns-2 md:columns-3 xl:columns-4 gap-3 md:gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <DynamicBlockSkeleton key={i} tall={i % 3 === 0} />
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
            <div className="columns-2 md:columns-3 xl:columns-4 gap-3 md:gap-4 animate-fade-in">
              {blocks}
            </div>
          )}
        </div>

        {/* Ranking sticky sólo desktop */}
        <StickyRanking items={rankingList} />
      </div>

      {/* Transición editorial → Cine */}
      <div className="mt-16 px-4 md:px-8">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-[10px] tracking-[0.5em] uppercase text-white/40">
            Sesión de cine
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      </div>

      <CinemaAccordion items={cinemaList} loading={cinemaQuery.isLoading} />
      <CinemaExtras
        items={cinemaList}
        upcomingItems={(upcomingMoviesQuery.data?.media || []).filter((a) => !hiddenSet.has(a.id))}
      />


      {/* Estadísticas de personajes */}
      <CharacterStats characters={characters} />


      {/* Ranking móvil compacto al final */}
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
