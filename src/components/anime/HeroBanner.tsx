import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, Info, Star, ChevronLeft, ChevronRight } from "lucide-react";
import { getTitle, getStatusLabel, getStatusColor, type AniListMedia } from "@/lib/anilist";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  animes: AniListMedia[];
}

function DesktopHero({ animes }: { animes: AniListMedia[] }) {
  const [items, setItems] = useState<AniListMedia[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (animes.length) setItems(animes.slice(0, 8));
  }, [animes]);

  const next = useCallback(() => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });
  }, []);

  const prev = useCallback(() => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const last = prev[prev.length - 1];
      return [last, ...prev.slice(0, -1)];
    });
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(next, 7000);
    return () => clearInterval(timerRef.current);
  }, [next]);

  const handleNav = (dir: "prev" | "next") => {
    clearInterval(timerRef.current);
    dir === "next" ? next() : prev();
    timerRef.current = setInterval(next, 7000);
  };

  if (!items.length) return <div className="w-full h-[500px] bg-secondary animate-pulse rounded-2xl" />;

  const activeAnime = items[1] || items[0];

  return (
    <div className="relative w-full h-[500px] overflow-hidden rounded-2xl mx-auto select-none">
      {items.map((item, i) => {
        const bg = item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large;
        return (
          <div key={item.id} className="absolute inset-0 transition-all duration-700" style={{ opacity: i <= 1 ? 1 : 0, zIndex: i === 0 ? 1 : 0 }}>
            <img src={bg} alt="" className="w-full h-full object-cover" />
          </div>
        );
      })}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-transparent to-background/30" />
      <div className="absolute bottom-0 left-0 z-20 p-8 pb-20 max-w-xl">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg text-primary-foreground ${getStatusColor(activeAnime.status)}`}>
            {getStatusLabel(activeAnime.status)}
          </span>
          {activeAnime.averageScore && (
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-lg">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-bold text-white">{(activeAnime.averageScore / 10).toFixed(1)}</span>
            </div>
          )}
        </div>
        <h1 className="text-3xl font-black text-white leading-tight tracking-tight mb-2 drop-shadow-xl animate-[animate_0.8s_ease-in-out_forwards]">{getTitle(activeAnime)}</h1>
        {activeAnime.description && (
          <p className="text-sm text-white/60 line-clamp-2 mb-4 max-w-md leading-relaxed animate-[animate_0.8s_ease-in-out_0.3s_forwards] opacity-0">
            {activeAnime.description.replace(/<[^>]*>/g, "").slice(0, 150)}...
          </p>
        )}
        <Link to={`/anime/${activeAnime.id}`} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-primary-foreground bg-primary/90 backdrop-blur-sm shadow-lg transition-all hover:scale-105 animate-[animate_0.8s_ease-in-out_0.6s_forwards] opacity-0">
          <Play className="w-4 h-4 fill-current" /> Ver Ahora
        </Link>
      </div>
      <div className="absolute z-20 right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {items.slice(2, 5).map((item, idx) => {
          const img = item.coverImage?.extraLarge || item.coverImage?.large;
          return (
            <Link key={item.id} to={`/anime/${item.id}`} className="w-[100px] h-[130px] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 transition-all duration-500 hover:scale-110 hover:ring-primary/50" style={{ transform: `translateX(${idx * 15}px)`, opacity: 1 - idx * 0.15 }}>
              <img src={img} alt={getTitle(item)} className="w-full h-full object-cover" />
            </Link>
          );
        })}
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-4">
        <button onClick={() => handleNav("prev")} className="w-10 h-9 rounded-lg border border-white/20 bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition">
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
        <button onClick={() => handleNav("next")} className="w-10 h-9 rounded-lg border border-white/20 bg-black/30 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition">
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}

function MobileHero({ animes }: { animes: AniListMedia[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const top = animes.slice(0, 6);

  useEffect(() => {
    if (!top.length) return;
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % top.length), 7000);
    return () => clearInterval(timerRef.current);
  }, [top.length]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((p) => (p + 1) % top.length), 7000);
  };

  if (!top.length) return <div className="w-full h-[55vh] bg-secondary animate-pulse" />;

  const anime = top[current];

  return (
    <div className="relative w-full h-[55vh] min-h-[360px] overflow-hidden bg-background select-none">
      {top.map((item, i) => {
        const bg = item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large;
        return (
          <div key={item.id} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === current ? 1 : 0, zIndex: 1 }}>
            <img src={bg} alt="" className="w-full h-full object-cover" />
          </div>
        );
      })}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-transparent to-background/20" />
      <div className="absolute bottom-0 left-0 right-0 z-20 p-5 pb-12">
        <div className="flex items-center gap-2 mb-2">
          <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md text-primary-foreground ${getStatusColor(anime.status)}`}>{getStatusLabel(anime.status)}</span>
          {anime.averageScore && (
            <div className="flex items-center gap-0.5 bg-black/40 px-1.5 py-0.5 rounded-md">
              <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
              <span className="text-[10px] font-bold text-white">{(anime.averageScore / 10).toFixed(1)}</span>
            </div>
          )}
        </div>
        <h1 className="text-2xl font-black text-white leading-tight mb-1">{getTitle(anime)}</h1>
        {anime.genres && <p className="text-[10px] text-white/50 mb-3">{anime.genres.slice(0, 3).join(" • ")}</p>}
        <div className="flex gap-3">
          <Link to={`/anime/${anime.id}`} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary">
            <Play className="w-3.5 h-3.5 fill-current" /> Ver Ahora
          </Link>
          <Link to={`/anime/${anime.id}`} className="flex items-center gap-1.5 bg-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-semibold">
            <Info className="w-3.5 h-3.5" /> Info
          </Link>
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
        {top.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} className={`transition-all duration-300 rounded-full ${i === current ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
        ))}
      </div>
    </div>
  );
}

export default function HeroBanner({ animes }: Props) {
  const isMobile = useIsMobile();
  if (!animes.length) return <div className="w-full h-[500px] bg-secondary animate-pulse rounded-2xl" />;
  return isMobile ? <MobileHero animes={animes} /> : <DesktopHero animes={animes} />;
}
