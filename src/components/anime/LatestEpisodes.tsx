import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Play, ChevronLeft, ChevronRight, Eye, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getAnimeViewsBatch, formatViews } from "@/lib/anime-views";
import { getHiddenAnimeIds } from "@/lib/hidden-animes";
import { useAuth } from "@/contexts/AuthContext";
import LazyImage from "@/components/LazyImage";
import AdCard from "@/components/ads/AdCard";

interface LatestRow {
  anilist_id: number;
  title: string;
  cover: string | null;
  banner: string | null;
  latest_episode: number;
  previous_episode: number;
  episode_updated_at: string;
}

interface RowWithViews extends LatestRow {
  views: number;
}

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
        <svg viewBox="0 0 24 24" className="w-12 h-12 opacity-30 animate-[zet-bolt-pulse_1.8s_ease-in-out_infinite]" fill="currentColor" style={{ color: "hsl(var(--muted-foreground))" }} aria-hidden>
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
        </svg>
      </div>
    </div>
  );
}

export default function LatestEpisodes() {
  const { isPremium } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["latest-episodes-auto"],
    queryFn: async (): Promise<RowWithViews[]> => {
      const { data: rows, error } = await supabase
        .from("auto_latest_episodes")
        .select("anilist_id, title, cover, banner, latest_episode, previous_episode, episode_updated_at")
        .eq("anilist_status", "RELEASING")
        .order("episode_updated_at", { ascending: false })
        .limit(30);
      if (error) throw error;

      const hidden = await getHiddenAnimeIds();
      const visible = (rows || []).filter((r: any) => !hidden.has(r.anilist_id)) as LatestRow[];

      const views = await getAnimeViewsBatch(visible.map((r) => r.anilist_id));
      return visible.map((r) => ({ ...r, views: views.get(r.anilist_id) || 0 }));
    },
    staleTime: 1000 * 60 * 5,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  const list = data || [];

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

      <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto px-4 hide-scrollbar">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <EpisodeSkeleton key={i} />)
          : list.flatMap((ep, i) => {
              const card = <EpisodeCardWide key={`${ep.anilist_id}-${i}`} row={ep} />;
              const shouldInsertAd = !isPremium && (i + 1) % 5 === 0 && i !== (list.length - 1);
              return shouldInsertAd ? [card, <EpisodeAdSlot key={`ad-${i}`} />] : [card];
            })}
      </div>

      {!isLoading && list.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8 px-4">
          Aún no hay episodios recientes. Se irán publicando en cuanto haya nuevos capítulos.
        </p>
      )}
    </section>
  );
}

function EpisodeCardWide({ row }: { row: RowWithViews }) {
  const navigate = useNavigate();
  const image = row.banner || row.cover;
  const isNew = row.latest_episode > row.previous_episode;

  return (
    <button
      onClick={() => navigate(`/anime/${row.anilist_id}`)}
      className="group relative flex-shrink-0 w-[280px] h-[140px] rounded-2xl overflow-hidden bg-secondary text-left ring-1 ring-border hover:ring-primary/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
    >
      {image ? (
        <LazyImage src={image} alt={row.title} className="absolute inset-0 w-full h-full" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs">Sin imagen</div>
      )}

      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

      {row.views > 0 && (
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm z-10">
          <Eye className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-bold text-white">{formatViews(row.views)} vistas</span>
        </div>
      )}

      {isNew && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[9px] font-black tracking-widest z-10 animate-pulse">
          NUEVO
        </div>
      )}
      {!isNew && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-primary/90 backdrop-blur-sm z-10">
          <span className="text-[9px] font-black text-primary-foreground tracking-wider">Z</span>
        </div>
      )}

      <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm z-10">
        <Clock className="w-2.5 h-2.5 text-white/80" />
        <span className="text-[9px] font-semibold text-white/90">24 min</span>
      </div>

      <div className="absolute bottom-2 left-2 right-20 z-10">
        <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
          Episodio {row.latest_episode}
        </p>
        <p className="text-[12px] font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
          {row.title}
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
