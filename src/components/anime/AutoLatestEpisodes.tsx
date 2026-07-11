// Carrusel de "Nuevos capítulos" alimentado por la tabla `auto_latest_episodes`,
// que la edge function sync-auto-episodes actualiza diariamente desde AniList.
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Play, Sparkles, Clock } from "lucide-react";
import LazyImage from "@/components/LazyImage";

type Row = {
  anilist_id: number;
  title: string;
  cover: string | null;
  banner: string | null;
  latest_episode: number;
  previous_episode: number;
  episode_updated_at: string;
};

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? "ayer" : `hace ${d} d`;
}

export default function AutoLatestEpisodes() {
  const { data, isLoading } = useQuery({
    queryKey: ["auto-latest-episodes"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("auto_latest_episodes")
        .select("anilist_id, title, cover, banner, latest_episode, previous_episode, episode_updated_at")
        .order("episode_updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as Row[];
    },
    staleTime: 1000 * 60 * 10,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) =>
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground tracking-tight inline-flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" /> Nuevos Capítulos en Emisión
        </h2>
        <div className="hidden md:flex items-center gap-2">
          <button onClick={() => scroll(-1)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => scroll(1)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-primary/20 hover:text-primary transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex items-center gap-3 overflow-x-auto px-4 hide-scrollbar">
        {isLoading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[280px] h-[140px] rounded-2xl bg-secondary animate-pulse" />
            ))
          : data!.map((row) => {
              const image = row.banner || row.cover;
              const isNew = row.latest_episode > row.previous_episode;
              return (
                <Link
                  key={row.anilist_id}
                  to={`/watch/${row.anilist_id}?ep=${row.latest_episode}`}
                  className="group relative flex-shrink-0 w-[280px] h-[140px] rounded-2xl overflow-hidden bg-secondary ring-1 ring-border hover:ring-primary/60 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                >
                  {image && <LazyImage src={image} alt={row.title} className="absolute inset-0 w-full h-full" />}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {isNew && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest z-10 animate-pulse">
                      NUEVO
                    </div>
                  )}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-semibold z-10 inline-flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {timeAgo(row.episode_updated_at)}
                  </div>

                  <div className="absolute bottom-2 left-2 right-2 z-10">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">
                      Episodio {row.latest_episode}
                    </p>
                    <p className="text-[12px] font-bold text-white line-clamp-2 leading-tight drop-shadow-md">
                      {row.title}
                    </p>
                  </div>

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 z-20">
                    <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary))]">
                      <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}
