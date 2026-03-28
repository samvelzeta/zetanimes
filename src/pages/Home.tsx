import { useState } from "react";
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

export default function Home() {
  const [splashDone, setSplashDone] = useState(() => {
    if (sessionStorage.getItem("zet_splash_done")) return true;
    return false;
  });

  const handleSplashComplete = () => {
    sessionStorage.setItem("zet_splash_done", "1");
    setSplashDone(true);
  };

  const { data: trending, isLoading: l1 } = useQuery({
    queryKey: ["trending"],
    queryFn: () => getTrending(1, 15),
    staleTime: 1000 * 60 * 10,
  });

  const { data: popular, isLoading: l2 } = useQuery({
    queryKey: ["popular"],
    queryFn: () => getPopular(1, 15),
    staleTime: 1000 * 60 * 10,
  });

  const { data: topRated, isLoading: l4 } = useQuery({
    queryKey: ["topRated"],
    queryFn: () => getTopRated(1, 15),
    staleTime: 1000 * 60 * 10,
  });

  const { data: season, isLoading: l5 } = useQuery({
    queryKey: ["thisSeason"],
    queryFn: () => getThisSeason(1, 15),
    staleTime: 1000 * 60 * 10,
  });

  const { data: actionAnimes, isLoading: lAction } = useQuery({
    queryKey: ["genre-action"],
    queryFn: () => getByGenre("Action", 1, 15),
    staleTime: 1000 * 60 * 10,
  });

  const { data: fantasyAnimes, isLoading: lFantasy } = useQuery({
    queryKey: ["genre-fantasy"],
    queryFn: () => getByGenre("Fantasy", 1, 15),
    staleTime: 1000 * 60 * 10,
  });

  return (
    <>
      {!splashDone && <SplashScreen onComplete={handleSplashComplete} />}
      <div className="min-h-screen">
        <HeroBanner animes={trending?.media || []} />

        <div className="mt-6 space-y-2">
          <LatestEpisodes />
          <BentoEpisodes />
          <GenreList />

          <SphereCarousel
            title="🔥 En Tendencia"
            animes={trending?.media || []}
            loading={l1}
            linkTo="/directory"
            variant="circle"
          />

          <FocusCarousel
            title="Acción"
            emoji="⚔️"
            animes={actionAnimes?.media || []}
            loading={lAction}
            linkTo="/directory?genre=Action"
          />

          <TopRanking
            title="📈 🏆 Top Rating"
            animes={topRated?.media || []}
            loading={l4}
          />

          <HorizontalList title="✨ Fantasía" animes={fantasyAnimes?.media || []} loading={lFantasy} linkTo="/directory?genre=Fantasy" />
          <HorizontalList title="🌸 Temporada Actual" animes={season?.media || []} loading={l5} showStatus />

          <SphereCarousel
            title="⭐ Más Populares"
            animes={popular?.media || []}
            loading={l2}
            linkTo="/directory"
            variant="circle"
          />

          <HorizontalList title="✨ Descubre" animes={popular?.media?.slice(5) || []} loading={l2} linkTo="/directory" />

          <AnimeRoulette animes={[...(trending?.media || []), ...(popular?.media || [])]} />
        </div>
      </div>
    </>
  );
}
