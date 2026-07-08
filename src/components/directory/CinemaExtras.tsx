import { Link } from "react-router-dom";
import { Ticket, Clapperboard, Film, Star, Calendar } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  items: AniListMedia[];
}

/**
 * CinemaExtras — extiende la sección Cine con:
 * - Marquee de títulos en cartel
 * - Spotlight ("Hoy en cartel") con la película destacada
 * - Poster wall con las restantes
 * - Ticket-strip con datos rápidos
 */
export default function CinemaExtras({ items }: Props) {
  if (!items || items.length < 2) return null;
  const feature = items[0];
  const rest = items.slice(1, 9);
  const titles = items.slice(0, 12).map(getTitle);

  return (
    <div className="mt-4">
      {/* Marquee de títulos */}
      <div className="relative border-y border-white/10 overflow-hidden bg-black/30">
        <div className="filmstrip-marquee whitespace-nowrap py-3 text-[13px] tracking-[0.35em] uppercase text-white/50">
          {titles.concat(titles).map((t, i) => (
            <span key={i} className="mx-6 inline-flex items-center gap-2">
              <Ticket className="w-3 h-3 text-primary inline-block" /> {t}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 mt-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6">
        {/* Spotlight: Hoy en cartel */}
        <Link
          to={`/anime/${feature.id}`}
          className="cinema-spotlight relative block rounded-3xl overflow-hidden border border-primary/20 bg-secondary/40 group"
          style={{ aspectRatio: "16 / 10" }}
        >
          <LazyImage
            src={feature.bannerImage || feature.coverImage?.extraLarge || feature.coverImage?.large || ""}
            alt={getTitle(feature)}
            className="w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-black/90 via-black/40 to-transparent" />
          <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-primary/90 text-primary-foreground px-3 py-1 text-[10px] tracking-[0.35em] uppercase">
            <Clapperboard className="w-3 h-3" /> Hoy en cartel
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
            <h3 className="directory-hero-title text-white text-2xl md:text-3xl font-bold line-clamp-2">
              {getTitle(feature)}
            </h3>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/80">
              {feature.seasonYear && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {feature.seasonYear}
                </span>
              )}
              {feature.averageScore && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Star className="w-3 h-3 fill-current" /> {(feature.averageScore / 10).toFixed(1)}
                </span>
              )}
              {feature.genres?.slice(0, 3).map((g) => (
                <span key={g} className="uppercase tracking-widest text-white/60">
                  {g}
                </span>
              ))}
            </div>
          </div>
        </Link>

        {/* Poster wall */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {rest.map((a, i) => (
            <Link
              key={a.id}
              to={`/anime/${a.id}`}
              className="relative rounded-xl overflow-hidden group border border-white/5 hover:border-primary/50 transition"
              style={{ aspectRatio: "2 / 3" }}
            >
              <LazyImage
                src={a.coverImage?.extraLarge || a.coverImage?.large || ""}
                alt={getTitle(a)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <div className="absolute bottom-1.5 left-1.5 right-1.5">
                <p className="text-[9px] text-primary/90 font-mono">
                  #{String(i + 2).padStart(2, "0")}
                </p>
                <p className="text-[10px] text-white line-clamp-2 leading-tight">{getTitle(a)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Ticket strip con datos rápidos */}
      <div className="mt-8 px-4 md:px-8">
        <div className="rounded-2xl border border-dashed border-primary/30 bg-black/30 p-4 md:p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <Stat icon={<Film className="w-4 h-4" />} label="En cartelera" value={String(items.length)} />
          <Stat
            icon={<Star className="w-4 h-4" />}
            label="Score promedio"
            value={
              items.filter((a) => a.averageScore).length
                ? (
                    items.reduce((s, a) => s + (a.averageScore || 0), 0) /
                    items.filter((a) => a.averageScore).length /
                    10
                  ).toFixed(1)
                : "—"
            }
          />
          <Stat
            icon={<Calendar className="w-4 h-4" />}
            label="Estreno más reciente"
            value={String(Math.max(...items.map((a) => a.seasonYear || 0)))}
          />
          <Stat
            icon={<Clapperboard className="w-4 h-4" />}
            label="Géneros únicos"
            value={String(new Set(items.flatMap((a) => a.genres || [])).size)}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-primary">{icon}</span>
      <span className="directory-hero-title text-xl md:text-2xl font-bold text-foreground">
        {value}
      </span>
      <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">{label}</span>
    </div>
  );
}
