import { useRef } from "react";
import AnimeCard from "@/components/anime/AnimeCard";
import AdCard from "@/components/ads/AdCard";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import type { AniListMedia } from "@/lib/anilist";

interface Props {
  title: string;
  animes: AniListMedia[];
  loading?: boolean;
  linkTo?: string;
  showStatus?: boolean;
}

export default function HorizontalList({ title, animes, loading, linkTo, showStatus = false }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 300, behavior: "smooth" });
    }
  };

  if (loading) {
    return (
      <div className="px-4 mb-8">
        <div className="h-5 w-36 bg-secondary rounded-md mb-4 animate-pulse" />
        <div className="flex gap-3 overflow-hidden">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="w-36 flex-shrink-0">
              <div className="aspect-[3/4] bg-secondary rounded-xl animate-pulse" />
              <div className="h-3 w-24 bg-secondary rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!animes || animes.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between px-4 mb-3">
        <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
        <div className="flex items-center gap-2">
          <button onClick={() => scroll(-1)} className="hidden md:flex w-8 h-8 rounded-full glass-chip items-center justify-center hover:bg-muted transition">
            <ChevronLeft className="w-4 h-4 text-foreground" />
          </button>
          <button onClick={() => scroll(1)} className="hidden md:flex w-8 h-8 rounded-full glass-chip items-center justify-center hover:bg-muted transition">
            <ChevronRight className="w-4 h-4 text-foreground" />
          </button>

          {linkTo && (
            <Link to={linkTo} className="flex items-center gap-0.5 text-primary text-xs font-medium">
              Ver todo <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto px-4 hide-scrollbar" style={{ scrollBehavior: "smooth" }}>
        {animes.map((anime, idx) => (
          <div key={anime.id} className="contents">
            <AnimeCard anime={anime} showStatus={showStatus} />
            {(idx + 1) % 3 === 0 && idx < animes.length - 1 && (
              <AdCard />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
