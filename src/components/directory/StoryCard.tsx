import { Link } from "react-router-dom";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  anime: AniListMedia;
  index?: number;
}

/**
 * Crónicas de Intriga — tarjeta editorial minimalista.
 * Sin foco en la miniatura: prioriza el "gancho" narrativo (curiosidad, dato, premio).
 */
export default function StoryCard({ anime, index = 0 }: Props) {
  const title = getTitle(anime);
  const raw = (anime.description || "").replace(/<[^>]+>/g, "").trim();
  // Primera frase como "gancho"
  const firstStop = raw.search(/[.!?]\s/);
  const hook = firstStop > 40 ? raw.slice(0, firstStop + 1) : raw.slice(0, 220);

  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const year = anime.seasonYear;
  const eps = anime.episodes;
  const genre = anime.genres?.[0];

  // Etiqueta editorial rotativa
  const labels = [
    "Crónica",
    "Dossier",
    "Retrato",
    "Perfil",
    "Apunte editorial",
  ];
  const label = labels[index % labels.length];

  // Dato curioso auto-generado
  const curiosities: string[] = [];
  if ((anime.popularity ?? 0) > 200000) curiosities.push("Fenómeno global");
  if ((anime.averageScore ?? 0) >= 85) curiosities.push("Aclamado por la crítica");
  if (eps && eps <= 12) curiosities.push("Formato breve · una sola temporada");
  else if (eps && eps >= 50) curiosities.push("Saga longeva");
  if (year && year <= 2005) curiosities.push("Clásico atemporal");
  if (curiosities.length === 0 && genre) curiosities.push(`Referente en ${genre}`);

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="story-card group block break-inside-avoid mb-3 md:mb-4 relative overflow-hidden rounded-2xl border border-white/10 hover:border-primary/50 transition-colors"
      style={{
        background:
          "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--secondary)/0.4) 100%)",
        animationDelay: `${(index % 5) * 60}ms`,
      }}
    >
      <div className="relative p-5 md:p-6">
        {/* Cabecera editorial */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[9px] tracking-[0.4em] uppercase text-primary/80">
            {label}
          </span>
          <span className="h-px flex-1 bg-white/10" />
          {score && (
            <span className="text-[10px] font-mono text-primary">★ {score}</span>
          )}
        </div>

        {/* Título serif */}
        <h3 className="directory-hero-title text-lg md:text-2xl font-bold text-foreground leading-snug line-clamp-3 group-hover:text-primary transition-colors">
          {title}
        </h3>

        {/* Hook narrativo */}
        {hook && (
          <p className="mt-3 text-[12px] md:text-sm text-muted-foreground leading-relaxed line-clamp-5 font-serif-body italic">
            "{hook}"
          </p>
        )}

        {/* Metadatos editoriales */}
        <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest text-white/40">
            {[year, genre].filter(Boolean).join(" · ")}
          </p>
          <span className="text-[10px] text-primary/80 group-hover:text-primary transition-colors">
            Leer más →
          </span>
        </div>

        {/* Curiosidad */}
        {curiosities[0] && (
          <p className="mt-3 text-[10px] text-white/50 italic">
            {curiosities[0]}
          </p>
        )}
      </div>
    </Link>
  );
}
