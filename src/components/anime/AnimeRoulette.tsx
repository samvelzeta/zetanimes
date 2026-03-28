import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Shuffle, Play } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  animes: AniListMedia[];
}

export default function AnimeRoulette({ animes }: Props) {
  const items = animes.slice(0, 12);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<AniListMedia | null>(null);
  const [rotation, setRotation] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const spin = useCallback(() => {
    if (spinning || items.length === 0) return;
    setSpinning(true);
    setResult(null);
    setSelectedIdx(null);

    const randomIdx = Math.floor(Math.random() * items.length);
    const sliceDeg = 360 / items.length;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    // The pointer is at top (270°). We need the randomIdx slice to land at the pointer.
    // Each item i is at angle (i / items.length) * 360 on the wheel.
    // We rotate the wheel so that item lands at top: targetAngle = -(randomIdx * sliceDeg)
    const targetDeg = extraSpins * 360 + (randomIdx * sliceDeg);

    setRotation((prev) => prev + targetDeg);
    setSelectedIdx(randomIdx);

    setTimeout(() => {
      setSpinning(false);
      setResult(items[randomIdx]);
    }, 3500);
  }, [spinning, items]);

  if (items.length < 3) return null;

  const radius = 200;

  return (
    <section className="mb-4 px-4">
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-foreground mb-1">🎰 ¿No sabes qué ver?</h2>
        <p className="text-sm text-muted-foreground">Deja que te recomendemos un anime al azar</p>
      </div>

      <div className="flex flex-col items-center">
        {/* Result - centered with pulsating animation */}
        {result && !spinning && (
          <div className="mb-4 flex flex-col items-center animate-[hero-slide-up_0.5s_ease-out_forwards]" style={{ opacity: 0 }}>
            <Link to={`/anime/${result.id}`} className="group text-center">
              <img
                src={result.coverImage?.extraLarge || result.coverImage?.large}
                alt={getTitle(result)}
                className="w-40 h-52 rounded-xl object-cover shadow-lg mx-auto animate-[roulette-pulse_2s_ease-in-out_infinite]"
              />
              <p className="mt-2 text-sm font-bold text-foreground group-hover:text-primary transition-colors">{getTitle(result)}</p>
              {result.genres && <p className="text-[10px] text-muted-foreground">{result.genres.slice(0, 3).join(" · ")}</p>}
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                <Play className="w-3 h-3 fill-current" /> Ver ahora
              </span>
            </Link>
          </div>
        )}

        {/* Half-moon arc */}
        <div className="relative w-full overflow-hidden" style={{ height: `${radius * 0.6 + 50}px` }}>
          <div
            className="absolute left-1/2"
            style={{
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              bottom: `-${radius * 0.7}px`,
            }}
          >
            {items.map((anime, i) => {
              const img = anime.coverImage?.large || anime.coverImage?.extraLarge;
              const angle = (i / items.length) * 360;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              return (
                <div
                  key={anime.id}
                  className="absolute w-[80px] h-[80px] rounded-full overflow-hidden border-2 border-primary/40 shadow-lg"
                  style={{
                    left: `${x}px`,
                    top: `${-y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <img src={img} alt={getTitle(anime)} className="w-full h-full object-cover" loading="lazy" />
                </div>
              );
            })}
            <div className="absolute w-12 h-12 rounded-full bg-background border-2 border-primary" style={{ left: "0px", top: "0px", transform: "translate(-50%, -50%)" }} />
          </div>
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning}
          className="mt-3 flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Shuffle className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          {spinning ? "Girando..." : "¡Gira la Ruleta!"}
        </button>
      </div>
    </section>
  );
}
