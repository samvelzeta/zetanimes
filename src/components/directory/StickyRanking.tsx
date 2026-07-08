import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";

/** Ranking semanal sticky (solo desktop). */
export default function StickyRanking({ items }: { items: AniListMedia[] }) {
  if (!items.length) return null;
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-20 directory-glass rounded-2xl p-4 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-primary" />
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/80 font-semibold">
            Ranking semanal
          </p>
        </div>
        <ol className="space-y-2.5">
          {items.slice(0, 12).map((a, i) => (
            <li key={a.id}>
              <Link
                to={`/anime/${a.id}`}
                className="group flex items-center gap-3 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span
                  className={`directory-hero-title text-lg font-bold w-6 text-center ${
                    i < 3 ? "text-primary" : "text-white/40"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="w-9 h-12 rounded overflow-hidden bg-secondary flex-shrink-0">
                  <LazyImage
                    src={a.coverImage?.large || ""}
                    alt={getTitle(a)}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {getTitle(a)}
                  </p>
                  {a.averageScore && (
                    <p className="text-[10px] text-primary/70 mt-0.5">
                      ★ {(a.averageScore / 10).toFixed(1)}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
