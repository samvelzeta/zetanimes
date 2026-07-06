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
import LikeButton from "@/components/anime/LikeButton";
import EpisodeList from "@/components/anime/EpisodeList";
import TechInfoBlock from "@/components/anime/TechInfoBlock";
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
  const { user, isPremium, isOwner } = useAuth();
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

  const streamingEpisodes = (anime as any).streamingEpisodes as { title?: string; thumbnail?: string }[] | undefined;
  const totalEps = anime.nextAiringEpisode?.episode ? anime.nextAiringEpisode.episode - 1 : (anime.episodes || 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative" style={{ isolation: "isolate" }}>
      {/* HERO BACKGROUND FIJO — capa base, siempre detrás */}
      <div
        className="fixed top-0 left-0 right-0 w-full h-[45vh] lg:h-[55vh] min-h-[320px] max-h-[620px] overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <img
          src={banner || cover}
          alt={title}
          className="w-full h-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/40 to-[#0a0a0a]/10" />
      </div>

      {/* Back button (fijo, sobre todo) */}
      <Link
        to="/"
        className="fixed top-4 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center pointer-events-auto"
        style={{ zIndex: 40 }}
      >
        <ArrowLeft className="w-5 h-5 text-white" />
      </Link>

      {/* HERO TÍTULO (solo móvil, superpuesto al fondo antes del scroll) */}
      <div
        className="relative h-[45vh] min-h-[320px] max-h-[520px] flex items-end px-4 pb-4 lg:hidden pointer-events-none"
        style={{ zIndex: 10 }}
      >
        <div className="w-full pointer-events-auto">
          <h1
            className="font-serif font-black text-white text-center leading-tight uppercase tracking-wide drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] text-[22px] sm:text-[26px]"
            style={{ overflowWrap: "anywhere" }}
          >
            {title}
          </h1>
          {anime.title.romaji && anime.title.romaji !== anime.title.english && (
            <p className="text-center text-xs text-white/60 mt-1 break-words" style={{ overflowWrap: "anywhere" }}>
              {anime.title.romaji}
            </p>
          )}
          <div className="mt-2 flex justify-center">
            <LikeButton anilistId={animeId} />
          </div>
        </div>
      </div>

      {/* Espaciador desktop para revelar el fondo al inicio */}
      <div className="hidden lg:block h-[55vh] min-h-[420px] max-h-[620px] relative pointer-events-none" style={{ zIndex: 10 }} />

      {/* CONTENIDO SCROLLEABLE — capa superior, siempre encima del fondo */}
      <div className="relative bg-[#0a0a0a] pb-24" style={{ zIndex: 20, isolation: "isolate" }}>
        {/* Gradiente de transición suave */}
        <div className="absolute -top-24 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-[#0a0a0a] pointer-events-none" style={{ zIndex: 0 }} />

        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 pt-6" style={{ zIndex: 1 }}>
          {/* DESKTOP HERO INFO — poster + info en fila */}
          <div className="hidden lg:flex gap-8 mb-8">
            <div className="relative flex-none group" style={{ zIndex: 2 }}>
              {/* Aura gradiente sutil alrededor del póster */}
              <div
                aria-hidden
                className="absolute -inset-[1.5px] rounded-2xl opacity-70 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -mt-32"
                style={{
                  background: "linear-gradient(140deg, hsl(var(--primary)/0.9), transparent 40%, hsl(var(--primary)/0.35) 100%)",
                  height: "calc(250px * 3 / 2 + 3px)",
                  width: "calc(250px + 3px)",
                }}
              />
              <img
                src={cover}
                alt={title}
                className="relative w-[250px] aspect-[2/3] object-cover rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] -mt-32 block transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              {/* Indicador de emisión: punto naranja pulsante */}
              {anime.status === "RELEASING" && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-primary/40 shadow-[0_0_18px_hsl(var(--primary)/0.35)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">En emisión</span>
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-2">
              <h1
                className="font-serif font-black text-white leading-[1.05] uppercase tracking-wide text-4xl xl:text-5xl"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.55)" }}
              >
                {title}
              </h1>
              {anime.title.romaji && anime.title.romaji !== anime.title.english && (
                <p className="text-sm text-white/50 mt-2 font-light tracking-[0.15em] uppercase">{anime.title.romaji}</p>
              )}
              <div className="mt-3">
                <LikeButton anilistId={animeId} />
              </div>
              {/* Floating Action Deck — glass panel */}
              <div className="mt-5 inline-flex items-center gap-2 p-2 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                <Link
                  to={`/watch/${animeId}?ep=1`}
                  className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black px-6 py-2.5 rounded-xl transition-all text-sm tracking-wider uppercase shadow-[0_6px_20px_hsl(var(--primary)/0.4)] hover:scale-[1.03] active:scale-[0.97]"
                >
                  <Play className="w-4 h-4 fill-current" /> Ver Ahora
                </Link>
                <div className="w-px h-8 bg-white/10 mx-1" />
                <div className="flex gap-1">
                  {LIST_CONFIG.map(({ type, icon: Icon, label }) => {
                    const isActive = activeLists.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => handleToggleList(type)}
                        disabled={loadingList}
                        title={label}
                        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg transition-all disabled:opacity-50 ${
                          isActive
                            ? "bg-primary/25 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                            : "text-white/60 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isActive ? "fill-current" : ""}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* MÓVIL: Ver Ahora + acciones (oculto en lg) */}
          <div className="lg:hidden">
            <Link
              to={`/watch/${animeId}?ep=1`}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black py-3.5 rounded-xl transition-all text-base shadow-[0_6px_20px_hsl(var(--primary)/0.35)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-5 h-5 fill-current" /> Ver Ahora
            </Link>

            <div className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar pb-1 justify-start sm:justify-center">
              {LIST_CONFIG.map(({ type, icon: Icon, label }) => {
                const isActive = activeLists.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => handleToggleList(type)}
                    disabled={loadingList}
                    className={`flex-none flex flex-col items-center justify-center gap-1 w-[64px] h-[68px] rounded-xl transition-all disabled:opacity-50 ${
                      isActive
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary text-muted-foreground border border-transparent hover:border-primary/30"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-semibold leading-none">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {isOwner ? (
            <SlugOverrideAdmin anilistId={animeId} animeTitle={title} coverImage={cover} />
          ) : (
            <TechInfoBlock
              title={title}
              studio={(anime as any).studios?.nodes?.find((s: any) => s.isAnimationStudio)?.name || (anime as any).studios?.nodes?.[0]?.name}
              format={anime.format}
            />
          )}

          {/* STATS — glass chips */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full text-primary-foreground ${getStatusColor(anime.status)}`}>{getStatusLabel(anime.status)}</span>
            {viewCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/[0.04] backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                <Eye className="w-3 h-3 text-primary" />
                <span className="text-[11px] font-semibold tracking-wider text-foreground">{formatViews(viewCount)}</span>
              </div>
            )}
            {anime.averageScore && (
              <div className="flex items-center gap-1.5 bg-white/[0.04] backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-[11px] font-semibold tracking-wider text-foreground">{(anime.averageScore / 10).toFixed(1)}</span>
              </div>
            )}
            {anime.episodes && (
              <div className="flex items-center gap-1.5 bg-white/[0.04] backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                <Tv className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] font-light tracking-widest text-muted-foreground uppercase">{anime.episodes} eps</span>
              </div>
            )}
            {anime.format && (
              <div className="flex items-center gap-1.5 bg-white/[0.04] backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                {anime.format === "MOVIE" ? <Film className="w-3 h-3 text-muted-foreground" /> : <Tv className="w-3 h-3 text-muted-foreground" />}
                <span className="text-[11px] font-light tracking-widest text-muted-foreground uppercase">{anime.format === "TV" ? "Serie" : anime.format === "MOVIE" ? "Película" : anime.format}</span>
              </div>
            )}
            {anime.seasonYear && (
              <div className="flex items-center gap-1.5 bg-white/[0.04] backdrop-blur-md border border-white/10 px-3 py-1 rounded-full">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className="text-[11px] font-light tracking-widest text-muted-foreground uppercase">{anime.season} {anime.seasonYear}</span>
              </div>
            )}
          </div>

          {anime.genres?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {anime.genres.map((g: string) => (
                <Link key={g} to={`/directory?genre=${g}`} className="px-3 py-1 bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-full text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-primary hover:border-primary/40 transition">{g}</Link>
              ))}
            </div>
          )}

          {/* SINOPSIS — glass card */}
          {description && (
            <div className="mt-6 max-w-3xl p-5 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <h2 className="text-[11px] font-black text-foreground mb-2 uppercase tracking-[0.25em]">Sinopsis</h2>
              <p className={`text-sm text-muted-foreground leading-relaxed font-light ${!showFullDesc && isLongDesc ? "line-clamp-4" : ""}`}>
                {showFullDesc || !isLongDesc ? description : description.slice(0, SYNOPSIS_LIMIT * 2)}
              </p>
              {isLongDesc && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="mt-2 flex items-center gap-1 text-primary text-xs font-bold tracking-wider uppercase hover:underline"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFullDesc ? "rotate-180" : ""}`} />
                  {showFullDesc ? "Ver menos" : "Ver más"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* CAPÍTULOS */}
        {totalEps > 0 && (
          <div className="mt-6 max-w-7xl mx-auto lg:px-8">
            <h2 className="px-4 lg:px-0 text-sm font-black text-foreground mb-3 uppercase tracking-wider">
              Capítulos <span className="text-muted-foreground font-normal">({totalEps})</span>
            </h2>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar px-4 lg:px-0 pb-1">
              {Array.from({ length: totalEps }, (_, i) => i + 1).map((ep) => {
                const meta = streamingEpisodes?.[ep - 1];
                const thumb = meta?.thumbnail || cover || "";
                const epTitle = meta?.title?.replace(/^Episode\s*\d+\s*[-:·—]?\s*/i, "") || "";
                return (
                  <Link
                    key={ep}
                    to={`/watch/${animeId}?ep=${ep}`}
                    className="flex-none w-[120px] h-[90px] lg:w-[180px] lg:h-[130px] rounded-[10px] overflow-hidden bg-secondary relative group"
                  >
                    <div className="h-[65%] w-full overflow-hidden">
                      <img src={thumb} alt={`Ep ${ep}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                    <div className="h-[35%] px-2 py-1 bg-black flex flex-col justify-center">
                      <span className="text-[10px] lg:text-xs font-black text-primary leading-none">Ep {ep}</span>
                      <span className="text-[10px] lg:text-xs font-semibold text-white truncate leading-tight mt-0.5">
                        {epTitle || "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="px-4 lg:px-8 mt-6 max-w-7xl mx-auto">
          <AdBannerInline size="468x60" />
        </div>

        {/* SECUELAS */}
        {(() => {
          const rel = (anime.relations?.edges || []).filter(
            (e: any) => e.node.type === "ANIME" && (e.relationType === "SEQUEL" || e.relationType === "PREQUEL")
          );
          if (rel.length === 0) return null;
          return (
            <div className="mt-6 max-w-7xl mx-auto lg:px-8">
              <h2 className="px-4 lg:px-0 text-sm font-black text-foreground mb-3 uppercase tracking-wider">Secuela</h2>
              <div className="flex gap-4 overflow-x-auto hide-scrollbar px-4 lg:px-0 pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible">
                {rel.map((edge: any) => {
                  const label = edge.relationType === "SEQUEL" ? "Secuela" : "Precuela";
                  const img = edge.node.bannerImage || edge.node.coverImage?.extraLarge || edge.node.coverImage?.large;
                  const relTitle = edge.node.title.english || edge.node.title.romaji;
                  return (
                    <Link
                      key={edge.node.id}
                      to={`/anime/${edge.node.id}`}
                      className="relative flex-none lg:flex-auto w-[220px] lg:w-auto h-[110px] lg:h-[140px] rounded-xl overflow-hidden border border-primary/80 group"
                    >
                      <img src={img} alt={relTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: "center 20%" }} loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider">
                        {label}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2.5">
                        <p className="text-white font-bold text-[12px] line-clamp-2 leading-tight drop-shadow-lg">{relTitle}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })()}


        {recommendations.length > 0 && (
          <div className="mt-6 px-4 lg:px-8 max-w-7xl mx-auto">
            <h2 className="text-sm font-black text-foreground mb-4 uppercase tracking-wider">Recomendaciones</h2>
            {/* Móvil: scroll horizontal · Desktop: grid tipo póster */}
            <div className="flex gap-3 overflow-x-auto hide-scrollbar lg:hidden">
              {recommendations.map((rec: any) => <AnimeCard key={rec.id} anime={rec} size="small" />)}
            </div>
            <div className="hidden lg:grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {recommendations.map((rec: any) => {
                const recTitle = rec.title?.english || rec.title?.romaji || "";
                const recImg = rec.coverImage?.extraLarge || rec.coverImage?.large;
                const recScore = rec.averageScore;
                return (
                  <Link key={rec.id} to={`/anime/${rec.id}`} className="group block">
                    <div className="relative w-full aspect-[2/3] overflow-hidden rounded-lg bg-secondary">
                      <img
                        src={recImg}
                        alt={recTitle}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {recScore && (
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded-md px-2 py-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-semibold text-white">{(recScore / 10).toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-foreground/90 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {recTitle}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {showAuthModal && <AuthRequiredModal onClose={() => setShowAuthModal(false)} message="Regístrate para guardar animes en tus listas, marcar favoritos y llevar control de lo que ves." />}
    </div>
  );
}

