import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X, Database, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ExportTrackerItem {
  id: string;
  anilist_id: number;
  title: string;
  total_episodes: number;
  airing_status: string | null;
  genres: string[] | null;
  created_at: string;
}

type FilterKey = "all" | "movies" | "series" | "releasing" | "finished" | "year";

const FILTERS: { key: FilterKey; label: string; hint: string }[] = [
  { key: "all", label: "Todos los completados", hint: "Exporta la lista completa con Seeke + Slugs" },
  { key: "movies", label: "Solo películas", hint: "1 episodio (formato MOVIE)" },
  { key: "series", label: "Solo series", hint: "Más de 1 episodio" },
  { key: "releasing", label: "En emisión", hint: "Todavía emitiéndose" },
  { key: "finished", label: "Finalizados", hint: "Emisión terminada" },
  { key: "year", label: "Por año", hint: "Filtra por año de agregado" },
];

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: ExportTrackerItem[];
}

export default function ExportCompletedDialog({ open, onClose, items }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    switch (filter) {
      case "movies":
        return items.filter((i) => (i.total_episodes || 0) <= 1);
      case "series":
        return items.filter((i) => (i.total_episodes || 0) > 1);
      case "releasing":
        return items.filter((i) => (i.airing_status || "").toUpperCase() === "RELEASING");
      case "finished":
        return items.filter((i) => (i.airing_status || "").toUpperCase() === "FINISHED");
      case "year": {
        const y = Number(year);
        if (!y) return [];
        return items.filter((i) => new Date(i.created_at).getFullYear() === y);
      }
      default:
        return items;
    }
  }, [items, filter, year]);

  if (!open) return null;

  const handleExport = async () => {
    if (filtered.length === 0) {
      toast.error("No hay animes que exportar con ese filtro");
      return;
    }
    setBusy(true);
    try {
      const anilistIds = filtered.map((f) => f.anilist_id);

      // Fetch Seeke links
      const { data: videoCacheData } = await supabase
        .from("video_cache")
        .select("anilist_id, slug, episode, lang, sources, anime_title")
        .in("anilist_id", anilistIds);

      // Fetch Slugs
      const { data: slugsData } = await supabase
        .from("slugs")
        .select("anilist_id, slug, manual_slug, title")
        .in("anilist_id", anilistIds);

      // Build maps
      const seekeByAnime = new Map<number, Array<{ slug: string; episode: number; lang: string; sources: any }>>();
      (videoCacheData || []).forEach((v: any) => {
        const arr = seekeByAnime.get(v.anilist_id) || [];
        arr.push({ slug: v.slug, episode: v.episode, lang: v.lang, sources: v.sources });
        seekeByAnime.set(v.anilist_id, arr);
      });

      const slugByAnime = new Map<number, { slug: string | null; manual_slug: string | null }>();
      (slugsData || []).forEach((s: any) => {
        slugByAnime.set(s.anilist_id, { slug: s.slug, manual_slug: s.manual_slug });
      });

      // Generate SQL
      const lines: string[] = [
        "-- ZetAnimes Export: Animes + Seeke + Slugs",
        `-- Generado: ${new Date().toISOString()}`,
        `-- Filtro: ${filter}${filter === "year" ? ` (${year})` : ""}`,
        `-- Total animes: ${filtered.length}`,
        "",
      ];

      // Section: Anime info
      lines.push("-- =====================");
      lines.push("-- ANIMES INDEXADOS");
      lines.push("-- =====================");
      filtered.forEach((anime) => {
        const slugInfo = slugByAnime.get(anime.anilist_id);
        const seeke = seekeByAnime.get(anime.anilist_id);
        lines.push(`-- [${anime.anilist_id}] ${anime.title} | eps: ${anime.total_episodes} | estado: ${anime.airing_status || "?"}`);
        if (slugInfo) {
          lines.push(`--   slug: ${slugInfo.slug || "—"} | manual: ${slugInfo.manual_slug || "—"}`);
        }
        if (seeke && seeke.length > 0) {
          const langs = [...new Set(seeke.map((s) => s.lang))];
          lines.push(`--   seeke langs: ${langs.join(", ")} | entries: ${seeke.length}`);
        }
        lines.push("");
      });

      // Section: Slugs INSERT
      lines.push("");
      lines.push("-- =====================");
      lines.push(`-- SLUGS (${slugsData?.length || 0} filas)`);
      lines.push("-- =====================");
      (slugsData || []).forEach((row: any) => {
        const cols = Object.keys(row);
        const vals = cols.map((c) => escapeSQL(row[c]));
        lines.push(`INSERT INTO slugs (${cols.join(", ")}) VALUES (${vals.join(", ")});`);
      });

      // Section: Video Cache INSERT
      lines.push("");
      lines.push("-- =====================");
      lines.push(`-- VIDEO_CACHE / Seeke (${videoCacheData?.length || 0} filas)`);
      lines.push("-- =====================");
      (videoCacheData || []).forEach((row: any) => {
        const cols = Object.keys(row);
        const vals = cols.map((c) => escapeSQL(row[c]));
        lines.push(`INSERT INTO video_cache (${cols.join(", ")}) VALUES (${vals.join(", ")});`);
      });

      // Download
      const blob = new Blob([lines.join("\n")], { type: "text/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = filter === "year" ? `-${year}` : `-${filter}`;
      a.download = `zetanimes-animes-seeke${suffix}-${stamp}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportados ${filtered.length} animes con Seeke + Slugs`);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error("Error al exportar: " + (err?.message || "desconocido"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">Exportar SQL (Animes + Seeke)</h3>
              <p className="text-[10px] text-muted-foreground">Incluye enlaces madre Seeke y slugs editados</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`w-full text-left p-3 rounded-xl border transition ${
                filter === f.key
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary/40 hover:bg-secondary"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{f.label}</span>
                {filter === f.key && (
                  <span className="text-[10px] font-bold text-primary">✓</span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{f.hint}</p>
            </button>
          ))}

          {filter === "year" && (
            <div className="pt-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Año</label>
              <input
                type="number"
                min="1990"
                max="2100"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            {filtered.length} anime{filtered.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0 || busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? "Generando..." : "Descargar .sql"}
          </button>
        </div>
      </div>
    </div>
  );
}
