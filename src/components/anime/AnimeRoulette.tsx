import { useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Shuffle, Play, Clock } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import LazyImage from "@/components/LazyImage";
import { toggleAnimeListSmart } from "@/lib/anime-lists";
import { useAuth } from "@/contexts/AuthContext";
import { useProfiles } from "@/contexts/ProfilesContext";
import { toast } from "sonner";

interface Props {
  animes: AniListMedia[];
}

export default function AnimeRoulette({ animes }: Props) {
  const items = animes.slice(0, 12);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<AniListMedia | null>(null);
  const [rotation, setRotation] = useState(0);
  const [addingLater, setAddingLater] = useState(false);
  const rotationRef = useRef(0);
  const { user } = useAuth();
  const { activeProfile } = useProfiles();

  const handleAddWatchLater = useCallback(async (anime: AniListMedia) => {
    if (!user) {
      toast.error("Inicia sesión para guardar en 'Ver después'");
      return;
    }
    setAddingLater(true);
    try {
      await toggleAnimeListSmart({
        userId: user.id,
        profileId: activeProfile?.id ?? null,
        animeId: anime.id,
        list: "plan_to_watch",
        currentLists: [],
        animeTitle: getTitle(anime),
        animeCover: anime.coverImage?.large || anime.coverImage?.extraLarge || "",
        isPremium: true,
      });
      toast.success("Añadido a 'Ver después'");
    } catch (e: any) {
      if (e?.code === "FREE_LIST_LIMIT") {
        toast.error("Alcanzaste el límite de listas del plan gratis");
      } else {
        toast.error("No se pudo añadir");
      }
    } finally {
      setAddingLater(false);
    }
  }, [user, activeProfile?.id]);

  const spin = useCallback(() => {
    if (spinning || items.length === 0) return;
    setSpinning(true);
    setResult(null);

    const randomIdx = Math.floor(Math.random() * items.length);
    const sliceDeg = 360 / items.length;
    const extraSpins = 5 + Math.floor(Math.random() * 3);

    // Item at angle α = randomIdx * sliceDeg (CCW from right).
    // Pointer is at top = 90° CCW from right.
    // After CW rotation θ, item at α appears at top when α = 90 + θ (mod 360)
    // So θ = α - 90 (mod 360)
    const itemAngle = randomIdx * sliceDeg;
    const targetAngle = itemAngle - 90;
    const remainder = ((targetAngle % 360) + 360) % 360;
    const minRotation = rotationRef.current + extraSpins * 360;
    const base = Math.ceil((minRotation - remainder) / 360) * 360 + remainder;

    rotationRef.current = base;
    setRotation(base);

    setTimeout(() => {
      setSpinning(false);
      setResult(items[randomIdx]);
    }, 3500);
  }, [spinning, items]);

  if (items.length < 3) return null;

  const radius = 240;

  return (
    <section className="relative mb-0 px-4 pt-5 pb-0 overflow-hidden isolate flex flex-col justify-end">
      {/* Fondo difuminado con el anime seleccionado */}
      {result && (
        <div key={result.id} className="pointer-events-none absolute inset-0 -z-10 animate-fade-in">
          <img
            src={result.bannerImage || result.coverImage?.extraLarge || result.coverImage?.large}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-45 blur-md scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/30 to-background/80" />
        </div>

      )}
      <div className="text-center mb-2">
        <h2 className="text-base font-black uppercase tracking-wide text-foreground">🎰 ¿NO SABES QUÉ VER?</h2>
        <p className="text-xs text-muted-foreground">Deja que te recomendemos un anime al azar</p>
      </div>


      <div className="flex flex-col items-center">
        {/* Result - centered with pulsating animation */}
        {result && !spinning && (() => {
          const isAiring = result.status === "RELEASING";
          return (
            <div className="mb-2 flex flex-col items-center animate-[hero-slide-up_0.5s_ease-out_forwards]" style={{ opacity: 0 }}>
              <Link to={`/anime/${result.id}`} className="group text-center">
                <img
                  src={result.coverImage?.extraLarge || result.coverImage?.large}
                  alt={getTitle(result)}
                  className="w-32 h-44 rounded-xl object-cover shadow-lg mx-auto animate-[roulette-pulse_2s_ease-in-out_infinite]"
                />
                <p className="mt-1 text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{getTitle(result)}</p>
                {result.genres && <p className="text-[10px] text-muted-foreground">{result.genres.slice(0, 3).join(" · ")}</p>}
              </Link>
              {isAiring ? (
                <button
                  onClick={() => handleAddWatchLater(result)}
                  disabled={addingLater}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline disabled:opacity-60"
                >
                  <Clock className="w-3 h-3" /> Añadir a ver después
                </button>
              ) : (
                <Link
                  to={`/anime/${result.id}`}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                >
                  <Play className="w-3 h-3 fill-current" /> Ver ahora
                </Link>
              )}
            </div>
          );
        })()}

        {/* Half-moon arc — limpio, con flecha externa, botón absoluto y sin círculo central fantasma */}
        <div className="relative w-full overflow-hidden pb-0 mb-0" style={{ height: `${radius + 55}px` }}>
          <div
            className="absolute left-1/2 bottom-0"
            style={{
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)" : "none",
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
                  className="absolute w-[75px] h-[75px] rounded-full overflow-hidden border-2 border-primary/40 shadow-lg"
                  style={{
                    left: `${x}px`,
                    top: `${-y}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <LazyImage src={img!} alt={getTitle(anime)} className="w-full h-full rounded-full" placeholderClassName="rounded-full" />
                </div>
              );
            })}
          </div>
          {/* Pointer — fuera de las esferas, apuntando a la esfera superior */}
          <div
            className="absolute left-1/2 top-2 -translate-x-1/2 z-40 w-0 h-0 border-l-[11px] border-r-[11px] border-t-[18px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg"
            aria-hidden="true"
          />

          {/* Spin button — absoluto, dentro del corazón del arco */}
          <button
            onClick={spin}
            disabled={spinning}
            className="absolute left-1/2 -translate-x-1/2 bottom-3 z-30 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-2xl transition-all hover:scale-105 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Shuffle className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`} />
            {spinning ? "Girando..." : "¡Gira la Ruleta!"}
          </button>

        </div>



      </div>
    </section>
  );
}
