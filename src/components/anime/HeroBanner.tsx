import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Play, Info, Star } from "lucide-react";
import { getTitle, getStatusLabel, getStatusColor, type AniListMedia } from "@/lib/anilist";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTV } from "@/hooks/useIsTV";
import { translateText } from "@/lib/translate";
import { playHeartbeat } from "@/lib/heartbeat-sound";
import LazyImage from "@/components/LazyImage";

interface Props {
  animes: AniListMedia[];
}

function DesktopHero({ animes }: { animes: AniListMedia[] }) {
  const navigate = useNavigate();
  const isTV = useIsTV();
  const [items, setItems] = useState<AniListMedia[]>([]);
  const [animKey, setAnimKey] = useState(0);
  const [entering, setEntering] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const [translatedDescs, setTranslatedDescs] = useState<Record<number, string>>({});

  useEffect(() => {
    if (animes.length) setItems(animes.slice(0, 8));
  }, [animes]);

  // Translate descriptions for hero items
  useEffect(() => {
    items.forEach((item) => {
      if (item.description && !translatedDescs[item.id]) {
        const raw = item.description.replace(/<[^>]*>/g, "").slice(0, 200);
        translateText(raw, `translate_hero_${item.id}`).then((t) => {
          setTranslatedDescs((prev) => ({ ...prev, [item.id]: t }));
        });
      }
    });
  }, [items]);

  const next = useCallback(() => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      return [...rest, first];
    });
    setAnimKey((k) => k + 1);
  }, []);

  const prev = useCallback(() => {
    setItems((prev) => {
      if (prev.length <= 1) return prev;
      const last = prev[prev.length - 1];
      return [last, ...prev.slice(0, -1)];
    });
    setAnimKey((k) => k + 1);
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(next, 7000);
    return () => clearInterval(timerRef.current);
  }, [next]);

  const handleEnter = (animeId: number) => {
    playHeartbeat();
    setEntering(true);
    clearInterval(timerRef.current);
    setTimeout(() => navigate(`/watch/${animeId}?ep=1`), isTV ? 300 : 900);
  };

  if (!items.length) return <div className="w-full h-[500px] bg-secondary animate-pulse rounded-2xl" />;

  const activeAnime = items[0];
  const desc = translatedDescs[activeAnime.id] || activeAnime.description?.replace(/<[^>]*>/g, "").slice(0, 150) || "";

  return (
    <div className={`relative w-full h-[500px] overflow-hidden rounded-2xl mx-auto select-none ${isTV ? "" : "transition-transform duration-[900ms]"} ${entering ? (isTV ? "opacity-0" : "scale-[1.3] opacity-0") : ""}`}>
      {items.map((item, i) => {
        const itemBg = item.bannerImage || item.coverImage?.extraLarge || item.coverImage?.large;
        return (
          <div key={item.id} className={`absolute inset-0 ${isTV ? "" : "transition-opacity duration-700"}`} style={{ opacity: i === 0 ? 1 : 0, zIndex: i === 0 ? 1 : 0 }}>
            <img src={itemBg} alt="" className="w-full h-full object-cover" />
          </div>
        );
      })}
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-transparent to-background/30" />

      <div className={`absolute bottom-0 left-0 z-20 p-8 pb-20 max-w-xl ${isTV ? "" : "transition-all duration-700"} ${entering ? "translate-y-20 opacity-0" : ""}`} key={`info-${animKey}`}>
        <div className={`flex flex-wrap items-center gap-2 mb-3 ${isTV ? "" : "animate-[hero-slide-up_0.6s_ease-out_forwards]"}`} style={isTV ? {} : { opacity: 0 }}>
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
        <h1 className={`text-3xl font-black text-white leading-tight tracking-tight mb-2 drop-shadow-xl line-clamp-2 ${isTV ? "" : "animate-[hero-slide-up_0.6s_ease-out_0.15s_forwards]"}`} style={isTV ? {} : { opacity: 0 }}>
          {(() => { const t = getTitle(activeAnime); return t.length > 100 ? t.slice(0, 100) + "…" : t; })()}
        </h1>
        {desc && (
          <p className={`text-sm text-white/60 line-clamp-2 mb-4 max-w-md leading-relaxed ${isTV ? "" : "animate-[hero-slide-up_0.6s_ease-out_0.3s_forwards]"}`} style={isTV ? {} : { opacity: 0 }}>
            {desc.slice(0, 150)}{desc.length > 150 ? "..." : ""}
          </p>
        )}
        <button
          onClick={() => handleEnter(activeAnime.id)}
          className={`neon-btn group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black text-primary-foreground bg-primary/90 backdrop-blur-sm shadow-lg ${isTV ? "" : "transition-all duration-300 hover:scale-110 animate-[hero-slide-up_0.6s_ease-out_0.45s_forwards]"} overflow-hidden`}
          style={isTV ? {} : { opacity: 0 }}
        >
          <Play className="w-4 h-4 fill-current relative z-10" />
          <span className="relative z-10">Ver Ahora</span>
        </button>
      </div>

      {!isTV && (
        <div className={`absolute z-20 right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3 transition-all duration-700 ${entering ? "translate-y-20 opacity-0" : ""}`}>
          {items.slice(1, 4).map((item, idx) => {
            const img = item.coverImage?.extraLarge || item.coverImage?.large;
            return (
              <button
                key={`thumb-${item.id}-${animKey}`}
                onClick={() => {
                  clearInterval(timerRef.current);
                  setItems((prev) => {
                    const filtered = prev.filter((p) => p.id !== item.id);
                    return [item, ...filtered];
                  });
                  setAnimKey((k) => k + 1);
                  timerRef.current = setInterval(next, 7000);
                }}
                className="w-[100px] h-[130px] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 transition-all duration-500 hover:scale-110 hover:ring-primary/50 animate-[hero-thumb-in_0.5s_ease-out_forwards]"
                style={{ transform: `translateX(${idx * 15}px)`, opacity: 0, animationDelay: `${idx * 0.12}s` }}
              >
                <img src={img} alt={getTitle(item)} className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MobileHero({ animes }: { animes: AniListMedia[] }) {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const top = animes.slice(0, 6);
  const [translatedDescs, setTranslatedDescs] = useState<Record<number, string>>({});

  // Translate descriptions
  useEffect(() => {
    top.forEach((item) => {
      if (item.description && !translatedDescs[item.id]) {
        const raw = item.description.replace(/<[^>]*>/g, "").slice(0, 150);
        translateText(raw, `translate_hero_${item.id}`).then((t) => {
          setTranslatedDescs((prev) => ({ ...prev, [item.id]: t }));
        });
      }
    });
  }, [top]);

  useEffect(() => {
    if (!top.length) return;
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % top.length);
      setAnimKey((k) => k + 1);
    }, 7000);
    return () => clearInterval(timerRef.current);
  }, [top.length]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    setAnimKey((k) => k + 1);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % top.length);
      setAnimKey((k) => k + 1);
    }, 7000);
  };

  if (!top.length) return <div className="w-full h-[55vh] bg-secondary animate-pulse" />;

  const anime = top[current];
  const desc = translatedDescs[anime.id] || "";

  return (
    <div className="relative w-full h-[55vh] min-h-[360px] overflow-hidden bg-background select-none">
      {/* En mobile: solo renderizamos la imagen activa para no componer 6 capas */}
      <div className="absolute inset-0" style={{ zIndex: 1 }}>
        <LazyImage
          key={anime.id}
          src={(anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large)!}
          alt=""
          className="w-full h-full"
        />
      </div>
      <div className="absolute inset-0 z-10 bg-gradient-to-r from-background via-background/70 to-transparent" />
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-background via-transparent to-background/20" />
      <div className="absolute bottom-0 left-0 right-0 z-20 p-5 pb-12" key={`mob-info-${animKey}`}>
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
        {desc && (
          <p className="text-[11px] text-white/50 line-clamp-2 mb-2 max-w-xs">
            {desc.slice(0, 120)}{desc.length > 120 ? "..." : ""}
          </p>
        )}
        {anime.genres && <p className="text-[10px] text-white/50 mb-3">{anime.genres.slice(0, 3).join(" • ")}</p>}
        <div className="flex gap-3">
          <button onClick={() => { playHeartbeat(); navigate(`/watch/${anime.id}?ep=1`); }} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-primary-foreground bg-primary active:scale-95 transition-transform">
            <Play className="w-3.5 h-3.5 fill-current" /> Ver Ahora
          </button>
          <Link to={`/anime/${anime.id}`} className="flex items-center gap-1.5 bg-white/10 text-white px-5 py-2.5 rounded-xl text-xs font-semibold">
            <Info className="w-3.5 h-3.5" /> Info
          </Link>
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex gap-1.5">
        {top.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} className={`transition-all duration-200 rounded-full ${i === current ? "w-6 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"}`} />
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
