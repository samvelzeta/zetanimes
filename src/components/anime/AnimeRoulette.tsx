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

  const spin = useCallback(() => {
    if (spinning || items.length === 0) return;
    setSpinning(true);
    setResult(null);

    const randomIdx = Math.floor(Math.random() * items.length);
    const sliceDeg = 360 / items.length;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetDeg = extraSpins * 360 + randomIdx * sliceDeg;

    setRotation((prev) => prev + targetDeg);

    setTimeout(() => {
      setSpinning(false);
      setResult(items[randomIdx]);
    }, 3500);
  }, [spinning, items]);

  if (items.length < 3) return null;

  const sliceDeg = 360 / items.length;
  // Position items in a half-moon (bottom half arc)
  const radius = 130;

  return (
    <section className="mb-8 px-4">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-foreground mb-1">🎰 ¿No sabes qué ver?</h2>
        <p className="text-sm text-muted-foreground">Deja que te recomendemos un anime al azar</p>
      </div>

      <div className="flex flex-col items-center">
        {/* Result - shown centered above the wheel */}
        {result && !spinning && (
          <div className="mb-6 flex flex-col items-center animate-[animate_0.5s_ease-out_forwards]">
            <Link to={`/anime/${result.id}`} className="group text-center">
              <img
                src={result.coverImage?.extraLarge || result.coverImage?.large}
                alt={getTitle(result)}
                className="w-32 h-44 rounded-xl object-cover shadow-lg ring-2 ring-primary/50 group-hover:ring-primary transition-all"
              />
              <p className="mt-2 text-sm font-bold text-foreground group-hover:text-primary transition-colors">{getTitle(result)}</p>
              {result.genres && <p className="text-[10px] text-muted-foreground">{result.genres.slice(0, 3).join(" · ")}</p>}
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">
                <Play className="w-3 h-3 fill-current" /> Ver ahora
              </span>
            </Link>
          </div>
        )}

        {/* Half-moon carousel at bottom */}
        <div className="relative w-full overflow-hidden" style={{ height: `${radius + 80}px` }}>
          <div
            className="absolute left-1/2 transition-transform"
            style={{
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
              bottom: `-${radius - 20}px`,
            }}
          >
            {items.map((anime, i) => {
              const img = anime.coverImage?.large || anime.coverImage?.extraLarge;
              // Arrange in a semicircle (180deg arc, bottom half)
              const angle = (i / items.length) * 360;
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * radius;
              const y = Math.sin(rad) * radius;

              return (
                <div
                  key={anime.id}
                  className="absolute w-14 h-14 rounded-full overflow-hidden border-2 border-primary/30"
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
            {/* Center circle */}
            <div className="absolute w-10 h-10 rounded-full bg-background border-2 border-primary" style={{ left: "0px", top: "0px", transform: "translate(-50%, -50%)" }} />
          </div>
          {/* Pointer */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
        </div>

        {/* Spin button */}
        <button
          onClick={spin}
          disabled={spinning}
          className="mt-4 flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Shuffle className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
          {spinning ? "Girando..." : "¡Gira la Ruleta!"}
        </button>
      </div>
    </section>
  );
}
