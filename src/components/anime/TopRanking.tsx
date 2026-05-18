import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { getTitle, type AniListMedia } from "@/lib/anilist";
import AdBanner300x250 from "@/components/ads/AdBanner300x250";
import LazyImage from "@/components/LazyImage";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  title: string;
  animes: AniListMedia[];
  loading?: boolean;
}

interface Override {
  position: number;
  anilist_id: number;
  anime_title: string | null;
  cover_image: string | null;
}

export default function TopRanking({ title, animes, loading }: Props) {
  const [overrides, setOverrides] = useState<Override[]>([]);

  useEffect(() => {
    supabase
      .from("ranking_overrides")
      .select("position, anilist_id, anime_title, cover_image")
      .eq("enabled", true)
      .order("position", { ascending: true })
      .then(({ data }) => setOverrides((data as Override[]) || []));
  }, []);

  if (loading) {
    return (
      <section className="px-4 mb-8">
        <div className="h-5 w-40 bg-secondary rounded-md mb-4 animate-pulse" />
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="h-20 bg-secondary rounded-xl mb-2 animate-pulse" />
        ))}
      </section>
    );
  }

  // Aplicar overrides: por cada posición con override, reemplazar el item en esa posición (1-indexed)
  let items: (AniListMedia | { __override: true; data: Override; base?: AniListMedia })[] = animes.slice(0, 10);
  if (overrides.length > 0) {
    items = items.slice(); // copy
    for (const ov of overrides) {
      const idx = ov.position - 1;
      if (idx < 0 || idx > 9) continue;
      // Asegurar tamaño
      while (items.length <= idx) items.push(undefined as any);
      const base = items[idx] as AniListMedia | undefined;
      items[idx] = { __override: true as const, data: ov, base };
    }
    items = items.filter(Boolean);
  }

  if (!items.length) return null;

  return (
    <section className="px-4 mb-8">
      <h2 className="text-base font-bold text-foreground tracking-tight mb-4">{title}</h2>
      <div className="space-y-2">
        {items.map((it, i) => {
          const isOverride = (it as any).__override === true;
          const ov = isOverride ? (it as any).data as Override : null;
          const base = isOverride ? (it as any).base as AniListMedia | undefined : (it as AniListMedia);
          const anilistId = ov?.anilist_id ?? base?.id;
          const titleText = ov?.anime_title || (base ? getTitle(base) : `#${i + 1}`);
          const img = ov?.cover_image || base?.coverImage?.large || base?.coverImage?.extraLarge;
          const score = base?.averageScore ? (base.averageScore / 10).toFixed(1) : null;
          const isTop3 = i < 3;
          return (
            <Link
              key={`${anilistId}-${i}`}
              to={`/anime/${anilistId}`}
              className={`group flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-secondary/80 ${isTop3 ? "bg-secondary border border-primary/20" : "bg-secondary/50"}`}
            >
              <div className="flex-shrink-0 w-12 flex items-center justify-center">
                <span className={`text-3xl font-black leading-none ${isTop3 ? "text-primary" : "text-muted-foreground/30"}`}>
                  {i + 1}
                </span>
              </div>

              <div className="flex-shrink-0 w-14 h-[72px] rounded-lg overflow-hidden ring-1 ring-border">
                {img && <LazyImage src={img} alt={titleText} className="w-full h-full" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  {titleText}
                </p>
                {base?.genres && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {base.genres.slice(0, 3).join(" · ")}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isTop3 ? "bg-primary" : "bg-muted-foreground/40"}`}
                      style={{ width: `${base?.averageScore || (isOverride ? 95 : 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {score && (
                <div className="flex items-center gap-1 flex-shrink-0 bg-black/20 rounded-lg px-2 py-1">
                  <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="text-sm font-black text-foreground">{score}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
      <AdBanner300x250 />
    </section>
  );
}
