import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { LayoutGrid, Sparkles, Sword, Skull, Compass, Flame, Wand2, Cpu, Tv, CheckCircle2, ListFilter } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "react-router-dom";
import LazyImage from "@/components/LazyImage";
import { getTitle, type AniListMedia } from "@/lib/anilist";

export interface CatalogState {
  categoryKey: string | null;
  yearRange: [number, number];
  ratingMin: number;
  status: "ALL" | "RELEASING" | "FINISHED";
}

export interface ThemedCategory {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  genres: string[];
}

export const THEMED_CATEGORIES: ThemedCategory[] = [
  { key: "heroes",    label: "El despertar de los héroes", icon: Sword,   genres: ["Action", "Adventure"] },
  { key: "darkness",  label: "Oscuridad pura",              icon: Skull,   genres: ["Horror", "Psychological", "Thriller"] },
  { key: "journey",   label: "Viajes inolvidables",         icon: Compass, genres: ["Adventure", "Fantasy"] },
  { key: "revenge",   label: "Venganza y redención",        icon: Flame,   genres: ["Drama", "Thriller"] },
  { key: "fantasy",   label: "Mundos de fantasía",          icon: Wand2,   genres: ["Fantasy", "Supernatural"] },
  { key: "scifi",     label: "Ciencia ficción profunda",    icon: Cpu,     genres: ["Sci-Fi", "Mecha"] },
];

const STORAGE_KEY = "zet:directory-catalog";
const NOW_YEAR = new Date().getFullYear();

export const DEFAULT_STATE: CatalogState = {
  categoryKey: null,
  yearRange: [2000, NOW_YEAR],
  ratingMin: 0,
  status: "ALL",
};

export function loadCatalogState(): CatalogState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed };
  } catch { return DEFAULT_STATE; }
}

interface Props {
  state: CatalogState;
  onChange: (next: CatalogState) => void;
  recommendations: AniListMedia[];
}

export default function CatalogDrawer({ state, onChange, recommendations }: Props) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* noop */ }
  }, [state]);

  const set = (patch: Partial<CatalogState>) => onChange({ ...state, ...patch });

  const activeCount =
    (state.categoryKey ? 1 : 0) +
    (state.status !== "ALL" ? 1 : 0) +
    (state.ratingMin > 0 ? 1 : 0) +
    (state.yearRange[0] !== 2000 || state.yearRange[1] !== NOW_YEAR ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={`fixed z-40 directory-glass rounded-full flex items-center gap-2 text-white font-medium shadow-xl hover:scale-105 transition-transform ${
            isMobile
              ? "bottom-24 right-4 w-14 h-14 justify-center"
              : "top-20 right-4 px-4 py-2.5 text-sm"
          }`}
          aria-label="Abrir catálogo"
        >
          <ListFilter className="w-5 h-5" />
          {!isMobile && <span>Catálogo</span>}
          {activeCount > 0 && (
            <span className="ml-1 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={`directory-glass border-primary/20 text-white overflow-y-auto ${
          isMobile ? "h-[85vh] rounded-t-3xl" : "w-full sm:max-w-md"
        }`}
      >
        <div className="pt-2 pb-8 space-y-6">
          <header>
            <p className="text-[10px] tracking-[0.4em] text-primary/80 uppercase">Catálogo</p>
            <h2 className="directory-hero-title text-2xl font-bold mt-1">Explora por sentimiento</h2>
          </header>

          {/* Categorías Temáticas */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3 flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5" /> Categorías
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {THEMED_CATEGORIES.map((c) => {
                const active = state.categoryKey === c.key;
                const Icon = c.icon;
                return (
                  <button
                    key={c.key}
                    onClick={() => set({ categoryKey: active ? null : c.key })}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      active
                        ? "bg-primary/25 border-primary text-white shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
                        : "bg-white/[0.03] border-white/10 hover:bg-white/[0.08] hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${active ? "text-primary" : "text-white/70"}`} />
                    <p className="text-[11px] font-semibold leading-tight">{c.label}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Filtros avanzados */}
          <section className="space-y-5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white/60">Filtros</h3>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/70">Año</span>
                <span className="text-xs font-mono text-primary">
                  {state.yearRange[0]} – {state.yearRange[1]}
                </span>
              </div>
              <Slider
                min={1990}
                max={NOW_YEAR}
                step={1}
                value={state.yearRange}
                onValueChange={(v) => set({ yearRange: [v[0], v[1]] as [number, number] })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/70">Rating mínimo</span>
                <span className="text-xs font-mono text-primary">
                  {(state.ratingMin / 10).toFixed(1)} / 10
                </span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[state.ratingMin]}
                onValueChange={(v) => set({ ratingMin: v[0] })}
              />
            </div>

            <div>
              <span className="text-xs text-white/70 mb-2 block">Estado</span>
              <div className="grid grid-cols-3 gap-1.5">
                {([
                  { v: "ALL", label: "Todos", Icon: LayoutGrid },
                  { v: "RELEASING", label: "En emisión", Icon: Tv },
                  { v: "FINISHED", label: "Finalizado", Icon: CheckCircle2 },
                ] as const).map(({ v, label, Icon }) => {
                  const active = state.status === v;
                  return (
                    <button
                      key={v}
                      onClick={() => set({ status: v })}
                      className={`px-2 py-2 rounded-lg text-[11px] font-medium flex flex-col items-center gap-1 transition-all ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-white/[0.04] text-white/70 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Recomendaciones */}
          {recommendations.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-3 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-primary" /> Para ti
              </h3>
              <div className="space-y-2">
                {recommendations.slice(0, 5).map((a) => (
                  <Link
                    key={a.id}
                    to={`/anime/${a.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] transition-colors border border-transparent hover:border-primary/30"
                  >
                    <div className="w-10 h-14 rounded overflow-hidden bg-secondary flex-shrink-0">
                      <LazyImage
                        src={a.coverImage?.large || a.coverImage?.extraLarge || ""}
                        alt={getTitle(a)}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white line-clamp-2 leading-tight">
                        {getTitle(a)}
                      </p>
                      {a.averageScore && (
                        <p className="text-[10px] text-primary mt-0.5">
                          ★ {(a.averageScore / 10).toFixed(1)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <button
            onClick={() => onChange(DEFAULT_STATE)}
            className="w-full py-2.5 rounded-lg text-xs font-medium border border-white/15 text-white/70 hover:bg-white/5 transition-colors"
          >
            Limpiar todo
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
