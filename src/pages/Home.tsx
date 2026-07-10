import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTrending, getPopular, getTopRated, getThisSeason, getByGenre } from "@/lib/anilist";
import VerticalCarousel from "@/components/directory/VerticalCarousel";
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
import { getApprovedAnimeIds, filterApprovedReleasing, onApprovedChange } from "@/lib/approved-animes";
import LazySection from "@/components/LazySection";
import AdBannerInline from "@/components/ads/AdBannerInline";
import TopOtakusWidget from "@/components/premium/TopOtakusWidget";

// Semilla determinista por año-semana ISO (rota cada lunes)
function weekSeed(): number {
  const d = new Date();
  const y = d.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const week = Math.ceil(((d.getTime() - start) / 86400000 + new Date(start).getUTCDay() + 1) / 7);
  return y * 100 + week;
}
function weeklyShuffle<T>(arr: T[]): T[] {
  const seed = weekSeed();
  return [...arr]
    .map((item, i) => ({ item, k: ((i + 1) * 2654435761 + seed) >>> 0 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
}
// Blacklist de IDs sobre-usados que rota semanalmente para no aparecer siempre
const OVERUSED_IDS = new Set<number>([16498, 101922, 113415, 21459, 5114, 20583, 11061, 30276]);
function skipOverusedSometimes(list: any[] | undefined): any[] {
  const week = weekSeed();
  // 3 de cada 4 semanas ocultamos los clásicos para dar variedad
  if (week % 4 === 0) return list || [];
  return (list || []).filter((a) => !OVERUSED_IDS.has(a.id));
}

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

  // Whitelist de animes en emisión aprobados (los RELEASING no aprobados se ocultan del Home)
  const { data: approvedIds, refetch: refetchApproved } = useQuery({
    queryKey: ["approved-anime-ids"],
    queryFn: async () => Array.from(await getApprovedAnimeIds(true)),
    staleTime: 1000 * 60 * 5,
  });
  const approvedSet = useMemo(() => new Set<number>(approvedIds || []), [approvedIds]);
  useEffect(() => onApprovedChange(() => { refetchApproved(); }), [refetchApproved]);

  const filterFn = (list: any[] | undefined) => {
    const noHidden = (list || []).filter((a) => !hiddenSet.has(a.id));
    return filterApprovedReleasing(noHidden, approvedSet);
  };

  // Above-the-fold: cargar inmediato (HeroBanner + Trending)
  const { data: trending, isLoading: l1, isError: trendingError } = useQuery({
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
  const [splashFallbackReady, setSplashFallbackReady] = useState(false);

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

  const wk = weekSeed();
  const actionPage = (wk % 4) + 1;
  const fantasyPage = ((wk + 2) % 4) + 1;

  const { data: actionAnimes, isLoading: lAction } = useQuery({
    queryKey: ["genre-action", actionPage],
    queryFn: () => getByGenre("Action", actionPage, isTV ? 20 : 30),
    staleTime: 1000 * 60 * 60 * 6,
    enabled: !isTV && enableAction,
  });

  const { data: fantasyAnimes, isLoading: lFantasy } = useQuery({
    queryKey: ["genre-fantasy", fantasyPage],
    queryFn: () => getByGenre("Fantasy", fantasyPage, 30),
    staleTime: 1000 * 60 * 60 * 6,
    enabled: !isTV && enableFantasy,
  });

  useEffect(() => {
    if (trending || trendingError || !l1) return;
    const timeout = window.setTimeout(() => setSplashFallbackReady(true), 7000);
    return () => window.clearTimeout(timeout);
  }, [trending, trendingError, l1]);

  // TV: Hero + Últimos Episodios + Bento + Géneros + Top Ranking.
  if (isTV) {
    return (
      <div className="min-h-screen space-y-6">
        <VerticalCarousel items={filterFn(trending?.media)} />
        <LatestEpisodes />
        <BentoEpisodes />
        <GenreList />
        <TopRanking
          title="🏆 Top de Animes"
          animes={filterFn(topRated?.media)}
          loading={l4}
        />
      </div>
    );
  }

  // Splash listo cuando la query crítica respondió o falló; nunca debe bloquear la app.
  const initialReady = !!trending || trendingError || !l1 || splashFallbackReady;

  return (
    <>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} ready={initialReady} />}
      <div className="min-h-screen">
        <VerticalCarousel items={filterFn(trending?.media)} />

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

          {/* ===== Layout asimétrico 70/30 en escritorio ===== */}
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:px-4 space-y-2 lg:space-y-0">
            {/* ===== Columna principal ===== */}
            <div className="lg:col-span-8 space-y-2 min-w-0">
              <LazySection minHeight={400}>
                <BentoEpisodes skip={5} hideHero title="⚡ Más Episodios Recientes" />
              </LazySection>

              <div className="border-t border-border/40 pt-2">
                <LazySection minHeight={400} placeholderClassName="" >
                  <ActionTrigger onMount={() => setEnableAction(true)} />
                  <FocusCarousel
                    title="Acción"
                    emoji="⚔️"
                    animes={weeklyShuffle(skipOverusedSometimes(filterFn(actionAnimes?.media))).slice(0, 15)}
                    loading={lAction}
                    linkTo="/directory?genre=Action"
                  />
                </LazySection>
              </div>

              <div className="border-t border-border/40 pt-2">
                <LazySection minHeight={300}>
                  <ActionTrigger onMount={() => setEnableFantasy(true)} />
                  <HorizontalList title="✨ Fantasía" animes={weeklyShuffle(skipOverusedSometimes(filterFn(fantasyAnimes?.media))).slice(0, 15)} loading={lFantasy} linkTo="/directory?genre=Fantasy" />
                </LazySection>
              </div>

              <LazySection minHeight={0}>
                <AdBannerInline size="468x60" />
              </LazySection>

              <div className="border-t border-border/40 pt-2">
                <LazySection minHeight={300}>
                  <HorizontalList title="✨ Descubre" animes={weeklyShuffle(skipOverusedSometimes(filterFn(popular?.media))).slice(0, 15)} loading={l2} linkTo="/directory" />
                </LazySection>
              </div>
            </div>

            {/* ===== Sidebar sticky (derecha en desktop, abajo en móvil) ===== */}
            <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto hide-scrollbar">
              <LazySection minHeight={320}>
                <TopOtakusWidget limit={5} title="🏆 Top Otakus de la semana" />
              </LazySection>

              <div className="border-t border-border/40 lg:border-t-0 pt-2 lg:pt-0">
                <LazySection minHeight={500}>
                  <ActionTrigger onMount={() => setEnableTopRated(true)} />
                  <TopRanking
                    title="🏆 Top 10 Semanal"
                    animes={filterFn(topRated?.media)}
                    loading={l4}
                  />
                </LazySection>
              </div>

              <div className="border-t border-border/40 pt-2">
                <LazySection minHeight={350}>
                  <SphereCarousel
                    title="🔥 En Tendencia"
                    animes={filterFn(trending?.media)}
                    loading={l1}
                    linkTo="/directory"
                    variant="circle"
                  />
                </LazySection>
              </div>

              <div className="border-t border-border/40 pt-2">
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
              </div>
            </aside>
          </div>

          {/* ===== Bloque destacado ancho completo ===== */}
          <div className="relative mt-4 py-6 bg-gradient-to-r from-background via-secondary/30 to-background border-y border-border/40">
            <LazySection minHeight={300}>
              <ActionTrigger onMount={() => setEnableSeason(true)} />
              <HorizontalList title="🌸 Temporada Actual" animes={filterFn(season?.media)} loading={l5} showStatus />
            </LazySection>
          </div>

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
