import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Ticket, Clapperboard, Film, Star, Calendar, Quote, Trophy, Sparkles, Popcorn, CalendarClock } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";


interface Props {
  items: AniListMedia[];
  upcomingItems?: AniListMedia[];
}


/**
 * CinemaExtras — sección Cine ampliada con módulos editoriales:
 * - Marquee de títulos en cartel
 * - Spotlight "Hoy en cartel" + Poster wall
 * - Cartel de próximos estrenos
 * - Ticket-strip con datos rápidos
 * - Cita del crítico (rotativa)
 * - Top taquilla (score)
 * - Programación por franja horaria
 * - Timeline por décadas
 * - Constelación de géneros
 */
export default function CinemaExtras({ items, upcomingItems = [] }: Props) {
  if (!items || items.length < 2) return null;

  const feature = items[0];
  const rest = items.slice(1, 9);
  const titles = items.slice(0, 12).map(getTitle);
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowTs = now.getTime();

  // Fecha de estreno como timestamp (o null si no hay)
  const releaseTs = (a: AniListMedia): number | null => {
    const s = a.startDate;
    if (!s?.year) return null;
    return new Date(s.year, (s.month || 1) - 1, s.day || 1).getTime();
  };

  // Próximos estrenos = películas NOT_YET_RELEASED de AniList (carrusel real)
  const upcoming = useMemo(() => {
    const pool = upcomingItems.length > 0
      ? upcomingItems
      : items.filter((a) => a.status === "NOT_YET_RELEASED" || (a.seasonYear || 0) > nowYear);
    return pool
      .slice()
      .sort((a, b) => {
        const ta = releaseTs(a) ?? Number.MAX_SAFE_INTEGER;
        const tb = releaseTs(b) ?? Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })
      .slice(0, 12);
  }, [items, upcomingItems, nowYear]);





  const topBox = useMemo(
    () => [...items].filter((a) => a.averageScore).sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0)).slice(0, 5),
    [items]
  );

  // Línea del tiempo: SOLO películas taquilleras (score alto). Se mantiene actualizada
  // con los datos de AniList — cambia solo, no lleva datos falsos.
  const decades = useMemo(() => {
    const BLOCKBUSTER_MIN = 75; // score AniList (0-100)
    const map = new Map<number, AniListMedia[]>();
    for (const a of items) {
      const y = a.seasonYear;
      if (!y) continue;
      if ((a.averageScore || 0) < BLOCKBUSTER_MIN) continue;
      const d = Math.floor(y / 10) * 10;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(a);
    }
    // Ordena las pelis de cada década por score desc para mostrar las mejores
    for (const arr of map.values()) arr.sort((a, b) => (b.averageScore || 0) - (a.averageScore || 0));
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [items]);


  const genreStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of items) for (const g of a.genres || []) map.set(g, (map.get(g) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [items]);

  const critic = useMemo(() => {
    const quotes = [
      { text: "Una experiencia visual que redefine la animación contemporánea.", src: "The Reel Critique" },
      { text: "Emoción pura en 24 fotogramas por segundo.", src: "Kinema Zeta" },
      { text: "Un renacer del cine de autor japonés.", src: "Cahiers du Anime" },
      { text: "Imprescindible en cualquier cartelera que se respete.", src: "Butaca Central" },
    ];
    return quotes[(feature.id || 0) % quotes.length];
  }, [feature.id]);

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

      {/* Spotlight + Poster wall */}
      <div className="px-4 md:px-8 mt-10 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6">
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
                <p className="text-[9px] text-primary/90 font-mono">#{String(i + 2).padStart(2, "0")}</p>
                <p className="text-[10px] text-white line-clamp-2 leading-tight">{getTitle(a)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Cita del crítico */}
      <div className="mt-10 px-4 md:px-8">
        <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-black/40 to-transparent p-6 md:p-10 overflow-hidden">
          <Quote className="absolute top-4 left-4 w-16 h-16 text-primary/15" />
          <div className="relative max-w-3xl mx-auto text-center">
            <p className="directory-hero-title font-serif-body italic text-lg md:text-2xl text-white/90 leading-relaxed">
              "{critic.text}"
            </p>
            <p className="mt-4 text-[10px] tracking-[0.45em] uppercase text-primary/80">
              — {critic.src}
            </p>
          </div>
        </div>
      </div>

      {/* Top taquilla + Próximos estrenos */}
      <div className="mt-10 px-4 md:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top taquilla */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-primary" />
            <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Top taquilla</p>
          </div>
          <ol className="space-y-2">
            {topBox.map((a, i) => (
              <li key={a.id}>
                <Link
                  to={`/anime/${a.id}`}
                  className="group flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 transition"
                >
                  <span className="directory-hero-title text-3xl font-black text-primary/70 w-10 text-center">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-none w-10 aspect-[2/3] rounded overflow-hidden bg-secondary">
                    <LazyImage
                      src={a.coverImage?.large || ""}
                      alt={getTitle(a)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                      {getTitle(a)}
                    </p>
                    <p className="text-[10px] text-white/50 uppercase tracking-widest">
                      {a.seasonYear || "—"} · {a.genres?.[0] || "Cine"}
                    </p>
                  </div>
                  <span className="text-primary font-mono text-xs">
                    ★ {((a.averageScore || 0) / 10).toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>

        {/* Próximos estrenos */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Popcorn className="w-4 h-4 text-primary" />
            <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Próximos estrenos</p>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-xs text-muted-foreground italic font-serif-body py-6 text-center">
              Sin fechas confirmadas por ahora.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-2">
              {upcoming.map((a) => (
                <Link
                  key={a.id}
                  to={`/anime/${a.id}`}
                  className="flex-none w-32 group"
                >
                  <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-white/10 group-hover:border-primary/50 transition">
                    <LazyImage
                      src={a.coverImage?.extraLarge || a.coverImage?.large || ""}
                      alt={getTitle(a)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute top-1.5 left-1.5 rounded-md bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5">
                      Próximo
                    </div>
                    <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white font-semibold line-clamp-2 leading-tight">
                      {getTitle(a)}
                    </p>
                  </div>
                  <p className="mt-1 text-[9px] tracking-[0.3em] uppercase text-primary/80 text-center">
                    {a.seasonYear || "TBA"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Constelación de géneros */}
      {genreStats.length > 0 && (
        <div className="mt-10 px-4 md:px-8">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/40 to-secondary/30 p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Constelación de géneros</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {genreStats.map(([g, n]) => {
                const size = 10 + Math.min(8, n);
                return (
                  <Link
                    key={g}
                    to={`/directory?genre=${encodeURIComponent(g)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-black/40 px-3 py-1.5 hover:border-primary hover:bg-primary/10 transition"
                    style={{ fontSize: `${size}px` }}
                  >
                    <span className="uppercase tracking-[0.25em] text-white/85">{g}</span>
                    <span className="text-primary font-mono text-[10px]">×{n}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Timeline por décadas */}
      {decades.length > 1 && (
        <div className="mt-10 px-4 md:px-8">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-5 md:p-6">
            <div className="flex items-center gap-2 mb-5">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Línea del tiempo</p>
            </div>
            <div className="relative">
              <div className="absolute left-0 right-0 top-4 h-px bg-primary/25" />
              <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-2">
                {decades.map(([d, arr]) => (
                  <div key={d} className="relative flex-none min-w-[120px]">
                    <div className="w-2 h-2 rounded-full bg-primary mx-auto mb-2 ring-4 ring-primary/20" />
                    <p className="directory-hero-title text-center text-lg font-bold text-white">{d}s</p>
                    <p className="text-center text-[10px] tracking-[0.3em] uppercase text-white/50 mt-0.5">
                      {arr.length} film{arr.length === 1 ? "" : "s"}
                    </p>
                    <div className="mt-2 flex justify-center gap-1">
                      {arr.slice(0, 3).map((a) => (
                        <Link
                          key={a.id}
                          to={`/anime/${a.id}`}
                          className="w-8 aspect-[2/3] rounded overflow-hidden border border-white/10 hover:border-primary transition"
                          title={getTitle(a)}
                        >
                          <LazyImage
                            src={a.coverImage?.large || ""}
                            alt={getTitle(a)}
                            className="w-full h-full object-cover"
                          />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ticket strip con datos rápidos */}
      <div className="mt-10 px-4 md:px-8">
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
