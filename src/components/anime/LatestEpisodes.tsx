import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLatestEpisodes, type ZetLatestEpisode } from "@/lib/zetapi";
import { searchAnime } from "@/lib/anilist";
import { AlertCircle, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

function EpisodeSkeleton() {
  return (
    <div className="animate-pulse flex-shrink-0 w-[110px]">
      <div className="aspect-[3/4] bg-secondary rounded-xl" />
      <div className="mt-2 space-y-1"><div className="h-2.5 w-20 bg-secondary rounded mx-auto" /></div>
    </div>
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
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground tracking-tight">⚡ Últimos Episodios</h2>
        <div className="hidden md:flex items-center gap-2">
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-3">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{(error as Error).message || "Error al cargar episodios."}</p>
        </div>
      )}

      <div ref={scrollRef} className="flex gap-3 overflow-x-auto px-4 hide-scrollbar">
        {isLoading
          ? Array(8).fill(0).map((_, i) => <EpisodeSkeleton key={i} />)
          : episodes?.map((ep, i) => <EpisodeCard key={`${ep.slug}-${i}`} episode={ep} />)}
      </div>

      {!isLoading && !error && episodes?.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8 px-4">No hay episodios.</p>
      )}
    </section>
  );
}

function EpisodeCard({ episode }: { episode: ZetLatestEpisode }) {
  const navigate = useNavigate();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      // Search AniList for the anime by title to get the correct ID
      const result = await searchAnime(episode.title, 1, 1);
      if (result.media.length > 0) {
        navigate(`/anime/${result.media[0].id}`);
        return;
      }
    } catch {
      // fallback
    }
    // Fallback: navigate to search
    navigate(`/search?q=${encodeURIComponent(episode.title)}`);
  };

  return (
    <button onClick={handleClick} className="group flex-shrink-0 w-[110px] block text-left">
      <div className="relative overflow-hidden rounded-xl aspect-[3/4] bg-secondary neon-card">
        {episode.cover ? (
          <img src={episode.cover} alt={episode.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sin imagen</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <Play className="w-8 h-8 text-white fill-white drop-shadow-lg" />
        </div>
        {episode.number && (
          <div className="absolute bottom-0 left-0 right-0 bg-primary/90 backdrop-blur-sm px-2 py-1 text-center">
            <span className="text-[9px] font-bold text-primary-foreground uppercase">EP {episode.number}</span>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[10px] font-medium text-muted-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors text-center">{episode.title}</p>
    </button>
  );
}
