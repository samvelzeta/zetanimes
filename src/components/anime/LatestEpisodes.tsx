import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatestEpisodes, type ZetLatestEpisode } from "@/lib/zetapi";
import { searchAnime } from "@/lib/anilist";
import { AlertCircle, Play, ChevronLeft, ChevronRight, Eye, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAnimeViewsBatch, formatViews } from "@/lib/anime-views";
import LazyImage from "@/components/LazyImage";

function EpisodeSkeleton() {
  return (
    <div className="animate-pulse flex-shrink-0 w-[280px] h-[140px] bg-secondary rounded-2xl" />
  );
}

export default function LatestEpisodes() {
  const { data: episodes, isLoading, error } = useQuery({
    queryKey: ["zet-latest-episodes"],
    queryFn: getLatestEpisodes,
    staleTime: 1000 * 60 * 3,
    retry: 1,
  });

  // Resolver títulos→anilistId→vistas (en background, no bloquea)
  const [viewsMap, setViewsMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!episodes?.length) return;
    let cancelled = false;
    (async () => {
      // Buscar anilistId por título (limitar concurrencia)
      const slugToAnilist = new Map<string, number>();
      for (const ep of episodes.slice(0, 12)) {
        try {
          const r = await searchAnime(ep.title, 1, 1);
          if (r.media[0]?.id) slugToAnilist.set(ep.slug, r.media[0].id);
        } catch { /* ignore */ }
        if (cancelled) return;
      }
      const ids = Array.from(slugToAnilist.values());
      if (!ids.length) return;
      const realViews = await getAnimeViewsBatch(ids);
      if (cancelled) return;
      const out = new Map<string, number>();
      slugToAnilist.forEach((aid, slug) => {
        out.set(slug, realViews.get(aid) || 0);
      });
      setViewsMap(out);
    })();
    return () => { cancelled = true; };
  }, [episodes]);

  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground tracking-tight">
          ⚡ Últimos Episodios
        </h2>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll(-1)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition"
          >
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={() => scroll(1)}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition"
          >
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-3">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">
            {(error as Error).message || "Error al cargar episodios."}
          </p>
        </div>
      )}

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto px-4 hide-scrollbar">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <EpisodeSkeleton key={i} />)
          : episodes?.map((ep, i) => (
              <EpisodeCardWide
                key={`${ep.slug}-${i}`}
                episode={ep}
                views={viewsMap.get(ep.slug) || 0}
              />
            ))}
      </div>

      {!isLoading && !error && episodes?.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8 px-4">
          No hay episodios.
        </p>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Tarjeta horizontal alargada con vistas REALES + lazy load
 * ------------------------------------------------------------------------- */
function EpisodeCardWide({
  episode,
  views,
}: {
  episode: ZetLatestEpisode;
  views: number;
}) {
  const navigate = useNavigate();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const result = await searchAnime(episode.title, 1, 1);
      if (result.media.length > 0) {
        navigate(`/anime/${result.media[0].id}`);
        return;
      }
    } catch { /* fallback */ }
    navigate(`/search?q=${encodeURIComponent(episode.title)}`);
  };

  return (
    <button
      onClick={handleClick}
      className="group relative flex-shrink-0 w-[280px] h-[140px] rounded-2xl overflow-hidden bg-secondary text-left ring-1 ring-border hover:ring-primary/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
    >
      {/* Cover de fondo (lazy + libera al salir del viewport) */}
      {episode.cover ? (
        <LazyImage
          src={episode.cover}
          alt={episode.title}
          className="absolute inset-0 w-full h-full"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
          Sin imagen
        </div>
      )}

      {/* Gradientes para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {/* Vistas REALES arriba-izquierda */}
      {views > 0 && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm z-10">
          <Eye className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-white">
            {formatViews(views)} vistas
          </span>
        </div>
      )}

      {/* Badge "Z" (ZetAnime) arriba-derecha */}
      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-primary/90 backdrop-blur-sm z-10">
        <span className="text-[9px] font-black text-primary-foreground tracking-wider">
          Z
        </span>
      </div>

      {/* Duración derecha-abajo */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm z-10">
        <Clock className="w-2.5 h-2.5 text-white/80" />
        <span className="text-[9px] font-semibold text-white/90">24 min</span>
      </div>

      {/* Info izquierda-abajo */}
      <div className="absolute bottom-2 left-2 right-20 z-10">
        {episode.number && (
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
            Episodio {episode.number}
          </p>
        )}
        <p className="text-[12px] font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
          {episode.title}
        </p>
      </div>

      {/* Play overlay en hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30 z-20">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary))]">
          <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
        </div>
      </div>
    </button>
  );
}
