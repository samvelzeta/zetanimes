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
import TechInfoBlock from "@/components/anime/TechInfoBlock";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { useEpisodeThumbnails } from "@/lib/episode-thumbnails";

type ListType = "favorite" | "watching" | "completed" | "plan_to_watch" | "undecided";

const LIST_CONFIG: { type: ListType; icon: typeof Heart; label: string }[] = [
  { type: "favorite", icon: Heart, label: "Favorito" },
  { type: "watching", icon: Eye, label: "Viendo" },
  { type: "plan_to_watch", icon: Clock, label: "Después" },
  { type: "completed", icon: CheckCircle, label: "Terminado" },
  { type: "undecided", icon: HelpCircle, label: "Indeciso" },
];

const SYNOPSIS_LIMIT = 240;

/** Encabezado editorial idéntico al usado en Directorio */
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className="mb-5">
      <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">{eyebrow}</p>
      <h2 className="directory-hero-title text-xl md:text-3xl font-bold text-foreground mt-1">
        {title}
      </h2>
      <div className="mt-3 h-px w-16 bg-primary/40" />
    </header>
  );
}

export default function AnimeDetail() {
  const { id } = useParams();
  const animeId = parseInt(id || "0");
  const { user, isOwner } = useAuth();
  const { permissions } = usePlanPermissions();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeLists, setActiveLists] = useState<ListType[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [translatedDesc, setTranslatedDesc] = useState<string | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [viewCount, setViewCount] = useState<number>(0);

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

  const rawDescription = anime?.description?.replace(/<[^>]*>/g, "") || "";
  useEffect(() => {
    if (!rawDescription || !animeId) return;
    translateText(rawDescription, `translate_${animeId}`).then((t) => setTranslatedDesc(t));
  }, [rawDescription, animeId]);

  const totalEpsForThumbs = (anime as any)?.nextAiringEpisode?.episode
    ? (anime as any).nextAiringEpisode.episode - 1
    : ((anime as any)?.episodes || 0);
  const episodeThumbs = useEpisodeThumbnails(anime as any, totalEpsForThumbs);

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
        <div className="w-full h-[60vh] bg-secondary directory-shimmer" />
        <div className="px-4 md:px-8 pt-6 space-y-3">
          <div className="h-3 w-24 bg-primary/30 rounded animate-pulse" />
          <div className="h-10 w-2/3 bg-secondary rounded animate-pulse" />
          <div className="h-20 w-full bg-secondary rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError || !anime) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="directory-hero-title text-lg font-bold text-foreground">No se pudo cargar este anime</p>
        <p className="text-xs text-muted-foreground max-w-sm font-serif-body italic">
          {(error as Error)?.message || "AniList no respondió. Puede ser un límite temporal de la API."}
        </p>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="rounded-full px-5 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest">
            Reintentar
          </button>
          <Link to="/" className="rounded-full px-5 py-2 directory-glass text-foreground text-xs font-bold uppercase tracking-widest">
            Volver
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
  const recommendations = anime.recommendations?.nodes?.map((n: any) => n.mediaRecommendation).filter(Boolean) || [];
  const streamingEpisodes = (anime as any).streamingEpisodes as { title?: string; thumbnail?: string }[] | undefined;
  const totalEps = anime.nextAiringEpisode?.episode ? anime.nextAiringEpisode.episode - 1 : (anime.episodes || 0);
  const studio = (anime as any).studios?.nodes?.find((s: any) => s.isAnimationStudio)?.name || (anime as any).studios?.nodes?.[0]?.name;

  return (
    <div className="min-h-screen bg-background text-foreground -mt-12">
      {/* ========= HERO CINEMATOGRÁFICO (mismo lenguaje que FilmstripShowcase) ========= */}
      <section className="relative w-full h-[78vh] md:h-[92vh] overflow-hidden">
        {/* Fondo nítido + capa blur para profundidad */}
        <img
          src={banner || cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
        <img
          src={banner || cover}
          alt=""
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-30"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-background/20 pointer-events-none" />

        {/* Volver */}
        <Link
          to="/"
          className="absolute top-14 md:top-20 left-4 md:left-8 z-30 w-10 h-10 rounded-full directory-glass flex items-center justify-center text-white hover:bg-primary/30 transition"
          aria-label="Volver"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Firma editorial */}
        <div className="absolute top-14 md:top-20 left-20 md:left-24 z-20 pointer-events-none">
          <p className="text-[10px] md:text-xs font-light tracking-[0.45em] text-white/70 uppercase">
            Ficha · {anime.format === "MOVIE" ? "Cine" : "Serie"}
          </p>
          <div className="mt-1 h-px w-10 bg-primary/60" />
        </div>

        {/* Contenido narrativo abajo */}
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 md:px-14 pb-10 md:pb-14 pt-8 bg-gradient-to-t from-background via-background/80 to-transparent">
          <div className="max-w-6xl mx-auto grid md:grid-cols-[220px_1fr] gap-6 md:gap-10 items-end">
            {/* Poster (desktop) */}
            <div className="hidden md:block relative group">
              <div
                aria-hidden
                className="absolute -inset-[2px] rounded-2xl opacity-70 group-hover:opacity-100 transition-opacity"
                style={{ background: "linear-gradient(140deg, hsl(var(--primary)/0.9), transparent 50%, hsl(var(--primary)/0.35))" }}
              />
              <img
                src={cover}
                alt={title}
                className="relative w-full aspect-[2/3] object-cover rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {anime.status === "RELEASING" && (
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full directory-glass border border-primary/40">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">En emisión</span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs tracking-[0.45em] uppercase text-primary/90 mb-2">
                {anime.seasonYear ? `${anime.season || ""} ${anime.seasonYear}` : "Publicación"}
                {studio ? <span className="text-white/50"> · {studio}</span> : null}
              </p>
              <h1 className="directory-hero-title text-3xl sm:text-4xl md:text-6xl font-bold text-white leading-[1.05] uppercase tracking-tight">
                {title}
              </h1>
              {anime.title.romaji && anime.title.romaji !== anime.title.english && (
                <p className="mt-2 text-xs md:text-sm text-white/50 font-light tracking-[0.2em] uppercase">
                  {anime.title.romaji}
                </p>
              )}
              {anime.genres?.length ? (
                <p className="mt-3 text-[11px] uppercase tracking-widest text-white/60">
                  {anime.genres.slice(0, 4).join(" · ")}
                  {anime.averageScore ? (
                    <span className="text-primary ml-3 font-mono">★ {(anime.averageScore / 10).toFixed(1)}</span>
                  ) : null}
                </p>
              ) : null}

              {/* Acción principal + like */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  to={`/watch/${animeId}?ep=1`}
                  className="rounded-full px-6 py-3 text-sm font-bold bg-primary text-primary-foreground inline-flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_10px_30px_hsl(var(--primary)/0.5)]"
                >
                  <Play className="w-4 h-4 fill-current" /> Ver ahora
                </Link>
                <div className="directory-glass rounded-full px-2 py-1.5">
                  <LikeButton anilistId={animeId} />
                </div>
                {anime.status === "RELEASING" && (
                  <div className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-full directory-glass border border-primary/40">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">En emisión</span>
                  </div>
                )}
              </div>

              {/* Deck de listas — glass horizontal */}
              <div className="mt-4 inline-flex flex-wrap items-center gap-1 p-1.5 rounded-2xl directory-glass border border-white/10">
                {LIST_CONFIG.map(({ type, icon: Icon, label }) => {
                  const isActive = activeLists.includes(type);
                  return (
                    <button
                      key={type}
                      onClick={() => handleToggleList(type)}
                      disabled={loadingList}
                      title={label}
                      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-[10px] uppercase tracking-[0.2em] font-bold transition-all disabled:opacity-50 ${
                        isActive
                          ? "bg-primary/25 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? "fill-current" : ""}`} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========= CUERPO EDITORIAL ========= */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-24 pt-10 space-y-14">
        {/* Poster móvil + metadata */}
        <section className="md:hidden -mt-24 relative z-10 flex justify-center">
          <img
            src={cover}
            alt={title}
            className="w-40 aspect-[2/3] object-cover rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] border border-white/10"
          />
        </section>

        {/* Tira metadata */}
        <section className="flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] uppercase tracking-[0.25em] text-muted-foreground border-y border-white/5 py-4">
          <span className={`px-3 py-1 rounded-full text-primary-foreground text-[10px] font-bold ${getStatusColor(anime.status)}`}>
            {getStatusLabel(anime.status)}
          </span>
          {viewCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-primary" /> {formatViews(viewCount)}
            </span>
          )}
          {anime.averageScore && (
            <span className="inline-flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> {(anime.averageScore / 10).toFixed(1)}
            </span>
          )}
          {anime.episodes && (
            <span className="inline-flex items-center gap-1.5">
              <Tv className="w-3.5 h-3.5" /> {anime.episodes} eps
            </span>
          )}
          {anime.format && (
            <span className="inline-flex items-center gap-1.5">
              {anime.format === "MOVIE" ? <Film className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
              {anime.format === "TV" ? "Serie" : anime.format === "MOVIE" ? "Película" : anime.format}
            </span>
          )}
          {anime.seasonYear && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> {anime.season} {anime.seasonYear}
            </span>
          )}
        </section>

        {/* Géneros como chips editoriales */}
        {anime.genres?.length > 0 && (
          <section className="flex flex-wrap gap-2 -mt-8">
            {anime.genres.map((g: string) => (
              <Link
                key={g}
                to={`/directory?genre=${g}`}
                className="directory-glass rounded-full px-3 py-1 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground hover:text-primary hover:border-primary/40 transition"
              >
                {g}
              </Link>
            ))}
          </section>
        )}

        {/* Ficha técnica */}
        <section>
          {isOwner ? (
            <SlugOverrideAdmin anilistId={animeId} animeTitle={title} coverImage={cover} />
          ) : (
            <TechInfoBlock title={title} studio={studio} format={anime.format} />
          )}
        </section>

        {/* Sinopsis editorial */}
        {description && (
          <section>
            <SectionHeader eyebrow="Editorial" title="Sinopsis" />
            <div className="max-w-3xl directory-glass rounded-2xl p-6 border border-white/10">
              <p className={`font-serif-body italic text-base md:text-lg leading-relaxed text-foreground/85 ${!showFullDesc && isLongDesc ? "line-clamp-5" : ""}`}>
                "{showFullDesc || !isLongDesc ? description : description.slice(0, SYNOPSIS_LIMIT * 2)}"
              </p>
              {isLongDesc && (
                <button
                  onClick={() => setShowFullDesc(!showFullDesc)}
                  className="mt-3 inline-flex items-center gap-1 text-primary text-[11px] font-bold tracking-[0.3em] uppercase hover:underline"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFullDesc ? "rotate-180" : ""}`} />
                  {showFullDesc ? "Cerrar" : "Ver más"}
                </button>
              )}
            </div>
          </section>
        )}

        {/* Capítulos */}
        {totalEps > 0 && (
          <section>
            <SectionHeader eyebrow="Episodios" title={`Capítulos (${totalEps})`} />
            <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
              {Array.from({ length: totalEps }, (_, i) => i + 1).map((ep) => {
                const meta = streamingEpisodes?.[ep - 1];
                const thumb = episodeThumbs[ep - 1] || cover || "";
                const epTitle = meta?.title?.replace(/^Episode\s*\d+\s*[-:·—]?\s*/i, "") || "";
                return (
                  <Link
                    key={ep}
                    to={`/watch/${animeId}?ep=${ep}`}
                    className="flex-none w-[140px] md:w-[200px] rounded-xl overflow-hidden bg-secondary/60 border border-white/5 hover:border-primary/40 transition group"
                  >
                    <div className="aspect-video w-full overflow-hidden">
                      <img src={thumb} alt={`Ep ${ep}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-[10px] tracking-[0.3em] uppercase text-primary font-bold">Ep {String(ep).padStart(2, "0")}</p>
                      <p className="text-xs text-white truncate leading-tight mt-0.5">{epTitle || "—"}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <AdBannerInline size="468x60" />

        {/* Temporadas relacionadas */}
        {(() => {
          const all = (anime.relations?.edges || []).filter(
            (e: any) => e.node.type === "ANIME" && (e.relationType === "SEQUEL" || e.relationType === "PREQUEL")
          );
          if (all.length === 0) return null;
          const prequels = all.filter((e: any) => e.relationType === "PREQUEL");
          const sequels = all.filter((e: any) => e.relationType === "SEQUEL");
          const rel = [...prequels, ...sequels];
          return (
            <section>
              <SectionHeader eyebrow="Saga" title="Temporadas relacionadas" />
              <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-1 md:grid md:grid-cols-3 lg:grid-cols-4 md:overflow-visible -mx-4 px-4 md:mx-0 md:px-0">
                {rel.map((edge: any) => {
                  const label = edge.relationType === "SEQUEL" ? "Secuela" : "Precuela";
                  const img = edge.node.bannerImage || edge.node.coverImage?.extraLarge || edge.node.coverImage?.large;
                  const relTitle = edge.node.title.english || edge.node.title.romaji;
                  return (
                    <Link
                      key={edge.node.id}
                      to={`/anime/${edge.node.id}`}
                      className="relative flex-none md:flex-auto w-[240px] md:w-auto h-[130px] rounded-xl overflow-hidden border border-primary/40 hover:border-primary transition group"
                    >
                      <img src={img} alt={relTitle} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" style={{ objectPosition: "center 20%" }} loading="lazy" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.25em]">
                        {label}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="directory-hero-title text-white font-bold text-sm line-clamp-2 leading-tight drop-shadow-lg">{relTitle}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* Recomendaciones */}
        {recommendations.length > 0 && (
          <section>
            <SectionHeader eyebrow="Sugerencias" title="Podría gustarte" />
            <div className="flex gap-3 overflow-x-auto hide-scrollbar md:hidden -mx-4 px-4">
              {recommendations.map((rec: any) => <AnimeCard key={rec.id} anime={rec} size="small" />)}
            </div>
            <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {recommendations.map((rec: any) => {
                const recTitle = rec.title?.english || rec.title?.romaji || "";
                const recImg = rec.coverImage?.extraLarge || rec.coverImage?.large;
                const recScore = rec.averageScore;
                return (
                  <Link key={rec.id} to={`/anime/${rec.id}`} className="group block">
                    <div className="relative w-full aspect-[2/3] overflow-hidden rounded-xl bg-secondary border border-white/5 group-hover:border-primary/40 transition">
                      <img
                        src={recImg}
                        alt={recTitle}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      {recScore && (
                        <div className="absolute top-2 right-2 flex items-center gap-0.5 directory-glass rounded-md px-2 py-1">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-[11px] font-semibold text-white">{(recScore / 10).toFixed(1)}</span>
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
          </section>
        )}
      </div>

      {showAuthModal && <AuthRequiredModal onClose={() => setShowAuthModal(false)} message="Regístrate para guardar animes en tus listas, marcar favoritos y llevar control de lo que ves." />}
    </div>
  );
}
