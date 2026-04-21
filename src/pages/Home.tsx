import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTrending, getPopular, getTopRated, getThisSeason, getByGenre } from "@/lib/anilist";
import HeroBanner from "@/components/anime/HeroBanner";
import HorizontalList from "@/components/anime/HorizontalList";
import LatestEpisodes from "@/components/anime/LatestEpisodes";
import BentoEpisodes from "@/components/anime/BentoEpisodes";
import GenreList from "@/components/anime/GenreList";
import SplashScreen from "@/components/anime/SplashScreen";
import SphereCarousel from "@/components/anime/SphereCarousel";
import TopRanking from "@/components/anime/TopRanking";
import FocusCarousel from "@/components/anime/FocusCarousel";
import AnimeRoulette from "@/components/anime/AnimeRoulette";
import { useIsTV } from "@/hooks/useIsTV";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import LazySection from "@/components/LazySection";
import AdBannerInline from "@/components/ads/AdBannerInline";

export default function Home() {
  const isTV = useIsTV();
  const [splashDone, setSplashDone] = useState(() => {
    if (sessionStorage.getItem("zet_splash_done")) return true;
    return false;
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem("zet_splash_done", "1");
    setSplashDone(true);
  };

  // Cargar IDs ocultos para filtrar listas
  const { data: hiddenIds } = useQuery({
    queryKey: ["hidden-anime-ids"],
    queryFn: async () => Array.from(await getHiddenAnimeIds()),
    staleTime: 1000 * 60 * 5,
  });
  const hiddenSet = useMemo(() => new Set(hiddenIds || []), [hiddenIds]);
  const filterFn = (list: any[] | undefined) => (list || []).filter((a) => !hiddenSet.has(a.id));

  // Above-the-fold: cargar inmediato (HeroBanner + Trending)
  const { data: trending, isLoading: l1 } = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrending(1, 15),
    staleTime: 1000 * 60 * 30,
  });

  // Below-the-fold: solo se disparan cuando LazySection las monte
  const [enablePopular, setEnablePopular] = useState(false);
  const [enableTopRated, setEnableTopRated] = useState(false);
  const [enableSeason, setEnableSeason] = useState(false);
  const [enableAction, setEnableAction] = useState(false);
  const [enableFantasy, setEnableFantasy] = useState(false);

  const { data: popular, isLoading: l2 } = useQuery({
    queryKey: ["popular"],
    queryFn: () => getPopular(1, 15),
    staleTime: 1000 * 60 * 30,
    enabled: enablePopular,
  });

  const { data: topRated, isLoading: l4 } = useQuery({
    queryKey: ["topRated"],
    queryFn: () => getTopRated(1, isTV ? 10 : 15),
    staleTime: 1000 * 60 * 30,
    // En TV se monta directo en el home simplificado; en PC espera al LazySection
    enabled: isTV || enableTopRated,
  });

  const { data: season, isLoading: l5 } = useQuery({
    queryKey: ["thisSeason"],
    queryFn: () => getThisSeason(1, isTV ? 10 : 15),
    staleTime: 1000 * 60 * 30,
    enabled: !isTV && enableSeason,
  });

  const { data: actionAnimes, isLoading: lAction } = useQuery({
    queryKey: ["genre-action"],
    queryFn: () => getByGenre("Action", 1, isTV ? 10 : 15),
    staleTime: 1000 * 60 * 30,
    enabled: !isTV && enableAction,
  });

  const { data: fantasyAnimes, isLoading: lFantasy } = useQuery({
    queryKey: ["genre-fantasy"],
    queryFn: () => getByGenre("Fantasy", 1, 15),
    staleTime: 1000 * 60 * 30,
    enabled: !isTV && enableFantasy,
  });

  // TV: Header + Bento + Top Ranking. Sin hero, sin carruseles extra (ahorra RAM).
  if (isTV) {
    return (
      <div className="min-h-screen px-2 mt-4 space-y-8">
        <header className="px-2">
          <h1 className="text-2xl font-black text-foreground tracking-tight">📺 ZetAnime TV</h1>
          <p className="text-xs text-muted-foreground mt-1">Episodios recientes y top ranking</p>
        </header>

        <section>
          <h2 className="text-base font-bold text-foreground mb-2 px-2">📡 Animes Recientes</h2>
          <BentoEpisodes />
        </section>

        <section>
          <h2 className="text-base font-bold text-foreground mb-2 px-2">🏆 Top de Animes</h2>
          <TopRanking title="" animes={filterFn(topRated?.media)} loading={l4} />
        </section>
      </div>
    );
  }

  // Splash listo cuando la query crítica (trending) haya respondido
  const initialReady = !!trending;

  return (
    <>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} ready={initialReady} />}
      <div className="min-h-screen">
        <HeroBanner animes={filterFn(trending?.media)} />

        <div className="mt-6 space-y-2">
          {/* Above-the-fold: montar inmediato */}
          <LatestEpisodes />

          {/* 728x90 leaderboard — sin minHeight para no dejar hueco si falla */}
          <LazySection minHeight={0}>
            <AdBannerInline size="728x90" />
          </LazySection>

          <LazySection minHeight={400}>
            <BentoEpisodes />
          </LazySection>

          <LazySection minHeight={120}>
            <GenreList />
          </LazySection>

          <LazySection minHeight={350}>
            <SphereCarousel
              title="🔥 En Tendencia"
              animes={filterFn(trending?.media)}
              loading={l1}
              linkTo="/directory"
              variant="circle"
            />
          </LazySection>

          <LazySection minHeight={400} placeholderClassName="" >
            {/* Trigger fetch de Action al montarse */}
            <ActionTrigger onMount={() => setEnableAction(true)} />
            <FocusCarousel
              title="Acción"
              emoji="⚔️"
              animes={filterFn(actionAnimes?.media)}
              loading={lAction}
              linkTo="/directory?genre=Action"
            />
          </LazySection>

          <LazySection minHeight={500}>
            <ActionTrigger onMount={() => setEnableTopRated(true)} />
            <TopRanking
              title="📈 🏆 Top Rating"
              animes={filterFn(topRated?.media)}
              loading={l4}
            />
          </LazySection>

          <LazySection minHeight={300}>
            <ActionTrigger onMount={() => setEnableFantasy(true)} />
            <HorizontalList title="✨ Fantasía" animes={filterFn(fantasyAnimes?.media)} loading={lFantasy} linkTo="/directory?genre=Fantasy" />
          </LazySection>

          <LazySection minHeight={300}>
            <ActionTrigger onMount={() => setEnableSeason(true)} />
            <HorizontalList title="🌸 Temporada Actual" animes={filterFn(season?.media)} loading={l5} showStatus />
          </LazySection>

          {/* 468x60 banner discreto — sin minHeight para no dejar hueco si falla */}
          <LazySection minHeight={0}>
            <AdBannerInline size="468x60" />
          </LazySection>

          <LazySection minHeight={350}>
            <ActionTrigger onMount={() => setEnablePopular(true)} />
            <SphereCarousel
              title="⭐ Más Populares"
              animes={filterFn(popular?.media)}
              loading={l2}
              linkTo="/directory"
              variant="circle"
            />
          </LazySection>

          <LazySection minHeight={300}>
            <HorizontalList title="✨ Descubre" animes={filterFn(popular?.media?.slice(5))} loading={l2} linkTo="/directory" />
          </LazySection>

          <LazySection minHeight={400}>
            <AnimeRoulette animes={[...filterFn(trending?.media), ...filterFn(popular?.media)]} />
          </LazySection>
        </div>
      </div>
    </>
  );
}

/** Pequeño helper que dispara onMount cuando se renderiza (cuando LazySection lo monta) */
function ActionTrigger({ onMount }: { onMount: () => void }) {
  useEffect(() => { onMount(); }, [onMount]);
  return null;
}
