import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAnimeById, getTitle, getStatusLabel, getStatusColor } from "@/lib/anilist";
import { Star, Play, ArrowLeft, Calendar, Tv, Film, Bookmark, Clock, CheckCircle, HelpCircle } from "lucide-react";
import AnimeCard from "@/components/anime/AnimeCard";
import { useState } from "react";

const LISTS_KEY = "zet_anime_lists";
type ListType = "saved" | "watch-later" | "finished" | "watching" | "undecided";

function getUserLists(): Record<string, ListType[]> {
  try { return JSON.parse(localStorage.getItem(LISTS_KEY) || "{}"); } catch { return {}; }
}

function toggleList(animeId: string, list: ListType) {
  const lists = getUserLists();
  if (!lists[animeId]) lists[animeId] = [];
  if (lists[animeId].includes(list)) {
    lists[animeId] = lists[animeId].filter((l) => l !== list);
  } else {
    lists[animeId] = lists[animeId].filter((l) => !["saved", "watch-later", "finished", "watching", "undecided"].includes(l));
    lists[animeId].push(list);
  }
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  return lists[animeId];
}

function getAnimeList(animeId: string): ListType[] {
  return getUserLists()[animeId] || [];
}

const LIST_CONFIG: { type: ListType; icon: typeof Bookmark; label: string }[] = [
  { type: "saved", icon: Bookmark, label: "Guardar" },
  { type: "watch-later", icon: Clock, label: "Ver más tarde" },
  { type: "watching", icon: Play, label: "Viendo" },
  { type: "finished", icon: CheckCircle, label: "Terminado" },
  { type: "undecided", icon: HelpCircle, label: "Indecisión" },
];

export default function AnimeDetail() {
  const { id } = useParams();
  const animeId = parseInt(id || "0");
  const [activeLists, setActiveLists] = useState<ListType[]>(() => getAnimeList(String(animeId)));

  const { data: anime, isLoading } = useQuery({
    queryKey: ["anime", animeId],
    queryFn: () => getAnimeById(animeId),
    enabled: animeId > 0,
    staleTime: 1000 * 60 * 10,
  });

  const handleToggleList = (list: ListType) => {
    const updated = toggleList(String(animeId), list);
    setActiveLists([...updated]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="w-full h-64 bg-secondary animate-pulse" />
        <div className="px-4 pt-4 space-y-3">
          <div className="h-8 w-64 bg-secondary rounded animate-pulse" />
          <div className="h-4 w-48 bg-secondary rounded animate-pulse" />
          <div className="h-20 w-full bg-secondary rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Anime no encontrado</p>
      </div>
    );
  }

  const title = getTitle(anime);
  const banner = anime.bannerImage || anime.coverImage?.extraLarge;
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const description = anime.description?.replace(/<[^>]*>/g, "") || "";
  const recommendations = anime.recommendations?.nodes?.map((n) => n.mediaRecommendation).filter(Boolean) || [];

  return (
    <div className="min-h-screen pb-24">
      <div className="relative w-full h-56 md:h-72">
        <img src={banner || cover} alt={title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <Link to="/" className="absolute top-4 left-4 z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>
      </div>

      <div className="px-4 -mt-16 relative z-10">
        <div className="flex gap-4">
          <img src={cover} alt={title} className="w-28 h-40 rounded-xl object-cover shadow-2xl border-2 border-background flex-shrink-0" />
          <div className="pt-16 flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground leading-tight">{title}</h1>
            {anime.title.romaji !== anime.title.english && anime.title.romaji && (
              <p className="text-xs text-muted-foreground mt-0.5">{anime.title.romaji}</p>
            )}
          </div>
        </div>

        <Link to={`/watch/${animeId}?ep=1`} className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all text-sm">
          <Play className="w-5 h-5 fill-current" /> Ver Ahora
        </Link>

        <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar pb-1">
          {LIST_CONFIG.map(({ type, icon: Icon, label }) => {
            const isActive = activeLists.includes(type);
            return (
              <button key={type} onClick={() => handleToggleList(type)} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg text-primary-foreground ${getStatusColor(anime.status)}`}>{getStatusLabel(anime.status)}</span>
          {anime.averageScore && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-lg">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-foreground">{(anime.averageScore / 10).toFixed(1)}</span>
            </div>
          )}
          {anime.episodes && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-lg">
              <Tv className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{anime.episodes} eps</span>
            </div>
          )}
          {anime.format && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-lg">
              {anime.format === "MOVIE" ? <Film className="w-3 h-3 text-muted-foreground" /> : <Tv className="w-3 h-3 text-muted-foreground" />}
              <span className="text-xs text-muted-foreground">{anime.format === "TV" ? "Serie" : anime.format === "MOVIE" ? "Película" : anime.format}</span>
            </div>
          )}
          {anime.seasonYear && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-lg">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{anime.season} {anime.seasonYear}</span>
            </div>
          )}
        </div>

        {anime.genres?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {anime.genres.map((g) => (
              <Link key={g} to={`/directory?genre=${g}`} className="px-2.5 py-1 bg-secondary rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary transition">{g}</Link>
            ))}
          </div>
        )}

        {description && (
          <div className="mt-4">
            <h2 className="text-sm font-bold text-foreground mb-2">Sinopsis</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
        )}

        {anime.relations?.edges && anime.relations.edges.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-foreground mb-3">Relacionados</h2>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar">
              {anime.relations.edges.filter(e => e.node.type === "ANIME").map((edge) => (
                <Link key={edge.node.id} to={`/anime/${edge.node.id}`} className="flex-shrink-0 w-28">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-secondary">
                    <img src={edge.node.coverImage?.large} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2">{edge.node.title.english || edge.node.title.romaji}</p>
                  <p className="text-[9px] text-primary">{edge.relationType}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-foreground mb-3">Recomendaciones</h2>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar">
              {recommendations.map((rec: any) => <AnimeCard key={rec.id} anime={rec} size="small" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
