import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatestEpisodes, type ZetLatestEpisode } from "@/lib/zetapi";
import { searchAnime } from "@/lib/anilist";
import { AlertCircle, Play, ChevronLeft, ChevronRight, Eye, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 hide-scrollbar"
      >
        {isLoading
          ? Array(6).fill(0).map((_, i) => <EpisodeSkeleton key={i} />)
          : episodes?.map((ep, i) => (
              <EpisodeCardWide key={`${ep.slug}-${i}`} episode={ep} />
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
 * Tarjeta horizontal alargada estilo "Crunchyroll/Netflix card"
 * Cover grande izquierda + info derecha (vistas, idioma, duración, título)
 * ------------------------------------------------------------------------- */
function EpisodeCardWide({ episode }: { episode: ZetLatestEpisode }) {
  const navigate = useNavigate();

  // Generar un número fake-pero-estable de "vistas" basado en el slug
  // (la API no provee este dato, lo simulamos para look & feel)
  const fakeViews = (() => {
    let h = 0;
    for (let i = 0; i < episode.slug.length; i++) {
      h = (h * 31 + episode.slug.charCodeAt(i)) | 0;
    }
    const n = Math.abs(h) % 900 + 80; // 80-980
    return n;
  })();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const result = await searchAnime(episode.title, 1, 1);
      if (result.media.length > 0) {
        navigate(`/anime/${result.media[0].id}`);
        return;
      }
    } catch {
      // fallback abajo
    }
    navigate(`/search?q=${encodeURIComponent(episode.title)}`);
  };

  return (
    <button
      onClick={handleClick}
      className="group relative flex-shrink-0 w-[280px] h-[140px] rounded-2xl overflow-hidden bg-secondary text-left ring-1 ring-border hover:ring-primary/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
    >
      {/* Cover de fondo */}
      {episode.cover ? (
        <img
          src={episode.cover}
          alt={episode.title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">
          Sin imagen
        </div>
      )}

      {/* Gradiente lateral oscuro (de izquierda a derecha) para legibilidad */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Vistas arriba-izquierda */}
      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
        <Eye className="w-3 h-3 text-primary" />
        <span className="text-[10px] font-bold text-white">
          {fakeViews} vistas
        </span>
      </div>

      {/* Badge JP arriba-derecha */}
      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-primary/90 backdrop-blur-sm">
        <span className="text-[9px] font-black text-primary-foreground tracking-wider">
          JP
        </span>
      </div>

      {/* Duración derecha-abajo */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
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
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary))]">
          <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
        </div>
      </div>
    </button>
  );
}
