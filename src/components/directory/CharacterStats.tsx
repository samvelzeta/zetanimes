import type { AniListCharacter } from "@/lib/anilist-characters";

interface Props {
  characters: AniListCharacter[];
}

/**
 * CharacterStats — cartas apiladas con círculo SVG + barra de progreso.
 * Inspiración: fan-out al hover, stat visible = popularidad relativa.
 */
export default function CharacterStats({ characters }: Props) {
  const list = characters.slice(0, 4);
  if (list.length < 3) return null;

  const max = Math.max(...list.map((c) => c.favourites), 1);

  return (
    <section className="mt-16 px-4 md:px-8">
      <div className="max-w-3xl mx-auto text-center mb-8">
        <p className="text-[10px] tracking-[0.45em] uppercase text-primary/80">Estadísticas</p>
        <h2 className="directory-hero-title text-2xl md:text-4xl font-bold text-foreground mt-1">
          Los más adorados
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-2">
          Ranking de personajes por número de favoritos en AniList.
        </p>
      </div>

      <div className="charstats-container mx-auto">
        {list.map((c, i) => {
          const pct = Math.round((c.favourites / max) * 100);
          const dashOffset = 360 - (pct / 100) * 260;
          return (
            <article key={c.id} className="charstats-card" style={{ zIndex: list.length - i }}>
              <div className="charstats-header">
                <p className="charstats-eyebrow">Top {i + 1}</p>
                <h3 className="charstats-title">{c.name}</h3>
                {c.animeTitle && <p className="charstats-source">{c.animeTitle}</p>}
              </div>

              <div className="charstats-bar">
                <div className="charstats-bar-empty" />
                <div className="charstats-bar-filled" style={{ ["--w" as any]: `${pct}%` }} />
              </div>

              <div className="charstats-circle">
                <svg viewBox="0 0 120 120" width="120" height="120">
                  <circle cx="60" cy="60" r="50" className="charstats-stroke-bg" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    className="charstats-stroke"
                    style={{ strokeDashoffset: dashOffset }}
                  />
                </svg>
                <div className="charstats-avatar">
                  <img src={c.image} alt={c.name} loading="lazy" />
                </div>
                <p className="charstats-value">
                  {c.favourites > 999 ? `${(c.favourites / 1000).toFixed(1)}k` : c.favourites}
                </p>
              </div>

              <div className="charstats-footer">
                {c.gender && <span>{c.gender}</span>}
                {c.age && <span>· {c.age} años</span>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
