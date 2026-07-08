import { Link } from "react-router-dom";
import { Play, TrendingUp, Star, Sparkles } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  feature: AniListMedia | null;   // wide banner (top)
  primary: AniListMedia | null;   // 60% block
  ranking: AniListMedia[];        // 40% quick access (top 3)
}

/**
 * Bento asimétrico:
 *  - Top: banner panorámico (feature del mes)
 *  - Bottom: [60% anime destacado] + [40% ranking en vivo]
 * En móvil colapsa a stack vertical.
 */
export default function HeaderBento({ feature, primary, ranking }: Props) {
  return (
    <section className="w-full px-4 md:px-8 pt-6 md:pt-10">
      {/* Firma DIRECTORIO */}
      <header className="flex items-end justify-between mb-4 md:mb-5">
        <div>
          <p className="text-[10px] md:text-xs tracking-[0.5em] uppercase text-primary/80 font-light">
            Zen · Directorio
          </p>
          <div className="mt-1 h-px w-14 bg-primary/60" />
        </div>
      </header>

      {/* Wide banner — feature del mes */}
      {feature && (
        <Link
          to={`/anime/${feature.id}`}
          className="group relative block w-full overflow-hidden rounded-2xl md:rounded-3xl directory-card"
          style={{ aspectRatio: "21 / 6" }}
        >
          <LazyImage
            src={feature.bannerImage || feature.coverImage?.extraLarge || ""}
            alt={getTitle(feature)}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
          <div className="absolute inset-y-0 left-0 flex flex-col justify-center px-5 md:px-10 max-w-xl">
            <div className="inline-flex items-center gap-2 text-[10px] md:text-xs uppercase tracking-[0.35em] text-primary mb-2">
              <Sparkles className="w-3 h-3 md:w-3.5 md:h-3.5" /> Feature del mes
            </div>
            <h2 className="directory-hero-title text-xl sm:text-3xl md:text-5xl font-bold text-white leading-tight line-clamp-2">
              {getTitle(feature)}
            </h2>
            <div className="mt-3 md:mt-5 hidden sm:inline-flex items-center gap-2 text-xs text-white/80">
              {feature.averageScore && (
                <span className="inline-flex items-center gap-1"><Star className="w-3 h-3 fill-primary text-primary" /> {(feature.averageScore/10).toFixed(1)}</span>
              )}
              {feature.seasonYear && <span>· {feature.seasonYear}</span>}
            </div>
          </div>
        </Link>
      )}

      {/* 60/40 asimétrico */}
      <div className="mt-4 md:mt-5 grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-5">
        {/* 60% anime destacado */}
        {primary && (
          <Link
            to={`/anime/${primary.id}`}
            className="group md:col-span-3 relative block overflow-hidden rounded-2xl directory-card"
            style={{ aspectRatio: "16 / 8" }}
          >
            <LazyImage
              src={primary.bannerImage || primary.coverImage?.extraLarge || ""}
              alt={getTitle(primary)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 md:p-6">
              <div className="inline-flex items-center gap-1.5 text-[9px] md:text-[10px] uppercase tracking-[0.3em] text-primary/90 mb-1.5">
                <Play className="w-3 h-3 fill-current" /> Destacado hoy
              </div>
              <h3 className="directory-hero-title text-lg md:text-2xl font-bold text-white line-clamp-2">
                {getTitle(primary)}
              </h3>
            </div>
          </Link>
        )}

        {/* 40% ranking en vivo */}
        <div className="md:col-span-2 rounded-2xl directory-glass p-3 md:p-4 flex flex-col" style={{ aspectRatio: "16 / 8" }}>
          <div className="flex items-center gap-2 mb-2 md:mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] text-white/70 font-semibold">
              Ranking en vivo
            </p>
          </div>
          <ul className="flex-1 flex flex-col justify-between gap-1.5 min-h-0">
            {ranking.slice(0, 3).map((a, i) => (
              <li key={a.id} className="min-h-0">
                <Link
                  to={`/anime/${a.id}`}
                  className="group flex items-center gap-2.5 md:gap-3 p-1.5 md:p-2 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <span className="directory-hero-title text-2xl md:text-4xl font-bold text-primary/80 w-6 md:w-8 text-center">
                    {i + 1}
                  </span>
                  <div className="w-8 h-11 md:w-10 md:h-14 rounded overflow-hidden bg-secondary flex-shrink-0">
                    <LazyImage src={a.coverImage?.large || ""} alt={getTitle(a)} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] md:text-xs text-white font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {getTitle(a)}
                    </p>
                    {a.averageScore && (
                      <p className="text-[9px] md:text-[10px] text-primary/80 mt-0.5">★ {(a.averageScore/10).toFixed(1)}</p>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
