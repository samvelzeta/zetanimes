import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatestEpisodes, type ZetLatestEpisode } from "@/lib/zetapi";
import { searchAnime } from "@/lib/anilist";
import { AlertCircle, Play, ChevronLeft, ChevronRight, Eye, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAnimeViewsBatch, formatViews } from "@/lib/anime-views";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import { useAuth } from "@/contexts/AuthContext";
import LazyImage from "@/components/LazyImage";
import AdCard from "@/components/ads/AdCard";

/** Slot de anuncio del MISMO ALTO que las tarjetas (140px). En premium no se renderiza. */
function EpisodeAdSlot() {
  return (
    <div className="flex-shrink-0 w-[180px] h-[140px] flex items-center justify-center">
      <div className="w-full h-full [&>div]:!w-full [&>div]:!h-full [&_.aspect-\[3\/4\]]:!aspect-auto [&_.aspect-\[3\/4\]]:!h-full [&>div]:!my-0 [&_p]:!hidden">
        <AdCard size="default" />
      </div>
    </div>
  );
}

function EpisodeSkeleton() {
  return (
    <div className="relative flex-shrink-0 w-[280px] h-[140px] bg-secondary rounded-2xl overflow-hidden animate-pulse">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className="w-12 h-12 opacity-30 animate-[zet-bolt-pulse_1.8s_ease-in-out_infinite]"
          fill="currentColor"
          style={{ color: "hsl(var(--muted-foreground))" }}
          aria-hidden
        >
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
        </svg>
      </div>
    </div>
  );
}

interface ResolvedEpisode extends ZetLatestEpisode {
  anilistId?: number;
}

export default function LatestEpisodes() {
  const { isPremium } = useAuth();
  const { data: episodes, isLoading, error } = useQuery({
    queryKey: ["zet-latest-episodes"],
    queryFn: getLatestEpisodes,
    staleTime: 1000 * 60 * 3,
    retry: 1,
  });

  // Mapping título→anilistId cacheado en localStorage para no rebuscar en cada visita.
  // No bloqueamos render: hacemos batches pequeños con pausa para no saturar AniList.
  const [resolved, setResolved] = useState<ResolvedEpisode[]>([]);
  const [viewsMap, setViewsMap] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!episodes?.length) return;
    let cancelled = false;

    // Lee cache local
    const readCache = (): Record<string, number> => {
      try { return JSON.parse(localStorage.getItem("zet_latest_anilist_map") || "{}"); }
      catch { return {}; }
    };
    const writeCache = (map: Record<string, number>) => {
      try { localStorage.setItem("zet_latest_anilist_map", JSON.stringify(map)); } catch { /* ignore */ }
    };

    (async () => {
      const hidden = await getHiddenAnimeIds();
      const cache = readCache();

      // Render inmediato: usa cache + sin filtrar (rápido).
      const initial: ResolvedEpisode[] = episodes
        .map((ep) => ({ ...ep, anilistId: cache[ep.title] }))
        .filter((ep) => !ep.anilistId || !hidden.has(ep.anilistId));
      if (!cancelled) setResolved(initial);

      // Carga vistas para los que ya tienen anilistId
      const knownIds = initial.map((e) => e.anilistId).filter(Boolean) as number[];
      if (knownIds.length) {
        const realViews = await getAnimeViewsBatch(knownIds);
        if (cancelled) return;
        const vmap = new Map<string, number>();
        initial.forEach((e) => { if (e.anilistId) vmap.set(e.slug, realViews.get(e.anilistId) || 0); });
        setViewsMap(vmap);
      }

      // Resuelve los que faltan en background (batches de 2 + pausa 300ms).
      const missing = episodes.filter((ep) => !cache[ep.title]);
      if (!missing.length) return;

      const updated = { ...cache };
      for (let i = 0; i < missing.length; i += 2) {
        if (cancelled) return;
        const batch = missing.slice(i, i + 2);
        await Promise.all(batch.map(async (ep) => {
          try {
            const r = await searchAnime(ep.title, 1, 1);
            const aid = r.media[0]?.id;
            if (aid) updated[ep.title] = aid;
          } catch { /* ignore */ }
        }));
        await new Promise((r) => setTimeout(r, 300));
      }
      if (cancelled) return;
      writeCache(updated);

      // Re-render con todos los IDs resueltos
      const finalList: ResolvedEpisode[] = episodes
        .map((ep) => ({ ...ep, anilistId: updated[ep.title] }))
        .filter((ep) => !ep.anilistId || !hidden.has(ep.anilistId));
      setResolved(finalList);
    })();

    return () => { cancelled = true; };
  }, [episodes]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const list = resolved.length ? resolved : (episodes || []).map((e) => ({ ...e } as ResolvedEpisode));

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

      <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto px-4 hide-scrollbar">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <EpisodeSkeleton key={i} />)
          : list.flatMap((ep, i) => {
              const card = (
                <EpisodeCardWide
                  key={`${ep.slug}-${i}`}
                  episode={ep}
                  views={viewsMap.get(ep.slug) || 0}
                />
              );
              // Anuncio cada 5 SOLO para usuarios free.
              // Premium: no insertamos el slot vacío para evitar el hueco entre tarjetas.
              const shouldInsertAd =
                !isPremium && (i + 1) % 5 === 0 && i !== (list.length - 1);
              return shouldInsertAd
                ? [card, <EpisodeAdSlot key={`ad-${i}`} />]
                : [card];
            })}
      </div>

      {!isLoading && !error && list.length === 0 && (
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
  episode: ResolvedEpisode;
  views: number;
}) {
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (episode.anilistId) {
      navigate(`/anime/${episode.anilistId}`);
      return;
    }
    // Resolver en el momento del click para evitar mandar al search
    if (resolving) return;
    setResolving(true);
    try {
      const r = await searchAnime(episode.title, 1, 1);
      const aid = r.media[0]?.id;
      if (aid) {
        // Guardar en cache local para próximas visitas
        try {
          const cache = JSON.parse(localStorage.getItem("zet_latest_anilist_map") || "{}");
          cache[episode.title] = aid;
          localStorage.setItem("zet_latest_anilist_map", JSON.stringify(cache));
        } catch { /* ignore */ }
        navigate(`/anime/${aid}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(episode.title)}`);
      }
    } catch {
      navigate(`/search?q=${encodeURIComponent(episode.title)}`);
    } finally {
      setResolving(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="group relative flex-shrink-0 w-[280px] h-[140px] rounded-2xl overflow-hidden bg-secondary text-left ring-1 ring-border hover:ring-primary/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
    >
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

      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {views > 0 && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm z-10">
          <Eye className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-white">
            {formatViews(views)} vistas
          </span>
        </div>
      )}

      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-primary/90 backdrop-blur-sm z-10">
        <span className="text-[9px] font-black text-primary-foreground tracking-wider">Z</span>
      </div>

      <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm z-10">
        <Clock className="w-2.5 h-2.5 text-white/80" />
        <span className="text-[9px] font-semibold text-white/90">24 min</span>
      </div>

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

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30 z-20">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary))]">
          <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
        </div>
      </div>
    </button>
  );
}
