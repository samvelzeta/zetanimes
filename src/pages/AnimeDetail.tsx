import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getAnimeById, getTitle, getStatusLabel, getStatusColor } from "@/lib/anilist";
import { Star, Play, ArrowLeft, Calendar, Tv, Film, Heart, Clock, CheckCircle, HelpCircle, Eye, ChevronDown } from "lucide-react";
import AnimeCard from "@/components/anime/AnimeCard";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { supabase } from "@/integrations/supabase/client";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import { toast } from "sonner";
import { translateText } from "@/lib/translate";
import { trackAnimeView, getAnimeViews, formatViews } from "@/lib/anime-views";
import AdBannerInline from "@/components/ads/AdBannerInline";
import SlugOverrideAdmin from "@/components/admin/SlugOverrideAdmin";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";

type ListType = "favorite" | "watching" | "completed" | "plan_to_watch" | "undecided";

const LIST_CONFIG: { type: ListType; icon: typeof Heart; label: string }[] = [
  { type: "favorite", icon: Heart, label: "Favorito" },
  { type: "watching", icon: Eye, label: "Viendo" },
  { type: "plan_to_watch", icon: Clock, label: "Ver después" },
  { type: "completed", icon: CheckCircle, label: "Terminado" },
  { type: "undecided", icon: HelpCircle, label: "Indecisión" },
];

const SYNOPSIS_LIMIT = 200;

export default function AnimeDetail() {
  const { id } = useParams();
  const animeId = parseInt(id || "0");
  const { user, isPremium } = useAuth();
  const { permissions } = usePlanPermissions();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeLists, setActiveLists] = useState<ListType[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [viewCount, setViewCount] = useState<number>(0);

  // Trackear vista (1 por sesión) y leer conteo actualizado
  useEffect(() => {
    if (!animeId) return;
    (async () => {
      await trackAnimeView(animeId);
      const v = await getAnimeViews(animeId);
      setViewCount(v);
    })();
  }, [animeId]);

  const { data: anime, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["anime", animeId],
    queryFn: () => getAnimeById(animeId),
    enabled: animeId > 0,
    staleTime: 1000 * 60 * 10,
    retry: 2,
  });

  const { activeProfile } = useProfiles();
  const profileId = activeProfile?.id ?? null;

  useQuery({
    queryKey: ["anime-list", animeId, user?.id, profileId],
    queryFn: async () => {
      if (!user) return [];
      let q = supabase
        .from("anime_lists")
        .select("list_type")
        .eq("user_id", user.id)
        .eq("anime_id", animeId);
      q = profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
      const { data } = await q;
      const types = (data?.map((d) => d.list_type) || []) as ListType[];
      setActiveLists(types);
      return types;
    },
    enabled: !!user && animeId > 0,
  });

  // Translation
  const rawDescription = anime?.description?.replace(/<[^>]*>/g, "") || "";
  useEffect(() => {
    if (!rawDescription || !animeId) return;
    translateText(rawDescription, `translate_${animeId}`).then((t) => {
      setTranslatedDesc(t);
    });
  }, [rawDescription, animeId]);

  const handleToggleList = async (list: ListType) => {
    if (!user) { setShowAuthModal(true); return; }
    setLoadingList(true);
    const title = anime ? getTitle(anime) : "";
    const cover = anime?.coverImage?.extraLarge || anime?.coverImage?.large || "";
    const wasActive = activeLists.includes(list);
    try {
      const { toggleAnimeListSmart } = await import("@/lib/anime-lists");
      const next = await toggleAnimeListSmart({
        userId: user.id, profileId, animeId, list, currentLists: activeLists,
        animeTitle: title, animeCover: cover, isPremium: permissions.multi_status_selection,
      });
      setActiveLists(next);
      toast.success(wasActive ? "Eliminado de la lista" : "Agregado a la lista");
    } catch (e: any) {
      if (e?.code === "FREE_LIST_LIMIT") {
        toast.error("Selección múltiple disponible al actualizar tu plan", {
          action: { label: "Ver planes", onClick: () => navigate("/profile?premium=1") },
        });
      } else {
        toast.error("Error al actualizar lista");
      }
    }
    setLoadingList(false);
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

  if (isError || !anime) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-base font-bold text-foreground">No se pudo cargar este anime</p>
        <p className="text-xs text-muted-foreground max-w-sm">
          {(error as Error)?.message || "AniList no respondió. Puede ser un límite temporal de la API."}
        </p>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition">
            Reintentar
          </button>
          <Link to="/" className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-bold hover:bg-muted transition">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const title = getTitle(anime);
  const banner = anime.bannerImage || anime.coverImage?.extraLarge;
  const cover = anime.coverImage?.extraLarge || anime.coverImage?.large;
  const description = translatedDesc || rawDescription;
  const isLongDesc = description.length > SYNOPSIS_LIMIT;
  const displayDesc = isLongDesc && !showFullDesc ? description.slice(0, SYNOPSIS_LIMIT) + "..." : description;
  const recommendations = anime.recommendations?.nodes?.map((n: any) => n.mediaRecommendation).filter(Boolean) || [];

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

        <Link to={`/watch/${animeId}?ep=1`} className="mt-4 w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-xl transition-all text-sm hover:scale-[1.02] active:scale-[0.98]">
          <Play className="w-5 h-5 fill-current" /> Ver Ahora
        </Link>

        <SlugOverrideAdmin anilistId={animeId} animeTitle={title} coverImage={cover} />

        <div className="flex gap-2 mt-3 overflow-x-auto hide-scrollbar pb-1">
          {LIST_CONFIG.map(({ type, icon: Icon, label }) => {
            const isActive = activeLists.includes(type);
            return (
              <button key={type} onClick={() => handleToggleList(type)} disabled={loadingList}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:bg-muted"
                } disabled:opacity-50`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg text-primary-foreground ${getStatusColor(anime.status)}`}>{getStatusLabel(anime.status)}</span>
          {viewCount > 0 && (
            <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded-lg">
              <Eye className="w-3 h-3 text-primary" />
              <span className="text-xs font-bold text-foreground">{formatViews(viewCount)} vistas</span>
            </div>
          )}
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
            {anime.genres.map((g: string) => (
              <Link key={g} to={`/directory?genre=${g}`} className="px-2.5 py-1 bg-secondary rounded-lg text-[10px] font-medium text-muted-foreground hover:text-primary transition">{g}</Link>
            ))}
          </div>
        )}

        {description && (
          <div className="mt-4">
            <h2 className="text-sm font-bold text-foreground mb-2">Sinopsis</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {displayDesc}
            </p>
            {isLongDesc && (
              <button
                onClick={() => setShowFullDesc(!showFullDesc)}
                className="mt-1 flex items-center gap-1 text-primary text-xs font-medium hover:underline"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showFullDesc ? "rotate-180" : ""}`} />
                {showFullDesc ? "Ver menos" : "Ver más"}
              </button>
            )}
          </div>
        )}

        {/* 468x60 banner discreto antes de Relacionados */}
        <div className="mt-6">
          <AdBannerInline size="468x60" />
        </div>

        {(() => {
          const rel = (anime.relations?.edges || []).filter(
            (e: any) => e.node.type === "ANIME" && (e.relationType === "SEQUEL" || e.relationType === "PREQUEL")
          );
          if (rel.length === 0) return null;
          return (
            <div className="mt-6">
              <h2 className="text-sm font-bold text-foreground mb-3">Temporadas relacionadas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {rel.map((edge: any) => {
                  const label = edge.relationType === "SEQUEL" ? "Secuela" : "Precuela";
                  const img = edge.node.bannerImage || edge.node.coverImage?.extraLarge || edge.node.coverImage?.large;
                  const title = edge.node.title.english || edge.node.title.romaji;
                  return (
                    <Link
                      key={edge.node.id}
                      to={`/anime/${edge.node.id}`}
                      className="relative aspect-[16/9] rounded-2xl overflow-hidden group neon-card"
                    >
                      <img src={img} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider">
                        {label}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="text-white font-bold text-sm line-clamp-2 drop-shadow-lg">{title}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {recommendations.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-foreground mb-3">Recomendaciones</h2>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar">
              {recommendations.map((rec: any) => <AnimeCard key={rec.id} anime={rec} size="small" />)}
            </div>
          </div>
        )}
      </div>

      {showAuthModal && <AuthRequiredModal onClose={() => setShowAuthModal(false)} message="Regístrate para guardar animes en tus listas, marcar favoritos y llevar control de lo que ves." />}
    </div>
  );
}
