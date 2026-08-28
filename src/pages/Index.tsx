import { useEffect, useState } from "react";
import SplashScreen from "@/components/anime/SplashScreen";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Index — pantalla de arranque unificada con Home / Directorio / Perfil.
 * Muestra el mismo SplashScreen (engranaje + rayo naranja) y un esqueleto
 * editorial con el shimmer/rayo de la marca mientras se prepara la app.
 */
export default function Index() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <SplashScreen onComplete={() => {}} ready={ready} />

      <div className="min-h-screen bg-background text-foreground">
        {/* Hero skeleton — imita VerticalCarousel / FilmstripShowcase */}
        <section className="relative w-full h-[70vh] md:h-[86vh] overflow-hidden">
          <Skeleton bolt className="absolute inset-0 rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-background/60 to-background pointer-events-none" />

          <div className="absolute top-14 left-4 sm:top-20 sm:left-8">
            <div className="h-2 w-24 bg-primary/40 rounded-full animate-pulse" />
            <div className="mt-2 h-px w-10 bg-primary/60" />
          </div>

          <div className="absolute inset-x-0 bottom-16 px-5 md:px-14 space-y-4">
            <Skeleton className="h-4 w-32 bg-primary/20" />
            <Skeleton className="h-10 md:h-14 w-3/4 md:w-1/2 bg-secondary/80" />
            <Skeleton className="h-3 w-1/2 bg-secondary/60" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-10 w-32 rounded-full bg-primary/30" />
              <Skeleton className="h-10 w-28 rounded-full bg-secondary/80" />
            </div>
          </div>
        </section>

        {/* Sección editorial — imita el masonry de Directorio */}
        <div className="px-4 md:px-8 mt-10 space-y-4">
          <div className="flex items-end justify-between">
            <div className="space-y-2">
              <Skeleton className="h-2 w-20 bg-primary/30" />
              <Skeleton className="h-6 w-56 bg-secondary/80" />
            </div>
            <Skeleton className="h-8 w-20 rounded-full bg-secondary/60" />
          </div>

          <div className="columns-2 md:columns-3 xl:columns-4 gap-3 md:gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="mb-3 md:mb-4 break-inside-avoid">
                <Skeleton
                  bolt
                  className={`w-full ${
                    i % 3 === 0 ? "aspect-[2/3]" : i % 4 === 0 ? "aspect-video" : "aspect-[3/4]"
                  } rounded-xl`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Franja tipo perfil */}
        <div className="px-4 md:px-8 mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-secondary/40 p-4 flex items-center gap-3"
            >
              <Skeleton className="h-12 w-12 rounded-full bg-primary/20" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3 bg-secondary/80" />
                <Skeleton className="h-2 w-1/2 bg-secondary/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
