import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";

interface Props {
  items: AniListMedia[];
  onNavigate?: () => void;
}

/**
 * Perfiles de Intriga — mini-bloque dentro del drawer.
 * Muestra 3 animes destacados (mayor averageScore) con un dato curioso.
 */
export default function IntrigueProfiles({ items, onNavigate }: Props) {
  const picks = [...items]
    .filter((a) => (a.averageScore ?? 0) >= 78)
    .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
    .slice(0, 3);

  if (picks.length === 0) return null;

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3 flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" /> Perfiles de intriga
      </h3>
      <div className="space-y-2">
        {picks.map((a, i) => {
          const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : null;
          const trendingRank = i + 1;
          const facts = [
            score ? `★ ${score}` : null,
            a.seasonYear ? `Estreno ${a.seasonYear}` : null,
            `Trending #${trendingRank}`,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={a.id}
              to={`/anime/${a.id}`}
              onClick={onNavigate}
              className="relative flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-primary/10 to-transparent hover:from-primary/20 border border-primary/20 hover:border-primary/50 transition-all"
            >
              <div className="w-12 h-16 rounded overflow-hidden bg-secondary flex-shrink-0">
                <LazyImage
                  src={a.coverImage?.large || a.coverImage?.extraLarge || ""}
                  alt={getTitle(a)}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                  {getTitle(a)}
                </p>
                <p className="text-[10px] text-primary mt-1 font-mono">{facts}</p>
                <p className="text-[10px] text-white/50 mt-0.5">Descubre por qué</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
