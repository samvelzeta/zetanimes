import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { X, FileSpreadsheet, Download, Loader2 } from "lucide-react";
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
  { key: "all", label: "Todos los completados", hint: "Exporta la lista completa" },
  { key: "movies", label: "Solo películas", hint: "1 episodio (formato MOVIE)" },
  { key: "series", label: "Solo series", hint: "Más de 1 episodio" },
  { key: "releasing", label: "En emisión", hint: "Todavía emitiéndose" },
  { key: "finished", label: "Finalizados", hint: "Emisión terminada" },
  { key: "year", label: "Por año", hint: "Filtra por año de agregado" },
];

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
      // Traer capítulos de todos los animes filtrados
      const ids = filtered.map((f) => f.id);
      const { data: epsData } = await supabase
        .from("anime_episode_downloads")
        .select("tracker_id, episode_number, downloaded")
        .in("tracker_id", ids)
        .order("episode_number");
      const epsByTracker = new Map<string, { episode_number: number; downloaded: boolean }[]>();
      (epsData || []).forEach((e: any) => {
        const arr = epsByTracker.get(e.tracker_id) || [];
        arr.push({ episode_number: e.episode_number, downloaded: e.downloaded });
        epsByTracker.set(e.tracker_id, arr);
      });

      // Hoja 1: resumen por anime
      const summaryRows = filtered.map((i) => {
        const eps = epsByTracker.get(i.id) || [];
        const done = eps.filter((e) => e.downloaded).length;
        return {
          "AniList ID": i.anilist_id,
          "Título": i.title,
          "Episodios totales": i.total_episodes ?? 0,
          "Episodios descargados": done,
          "Estado emisión": i.airing_status ?? "—",
          "Géneros": (i.genres || []).join(", "),
          "Agregado": new Date(i.created_at).toLocaleDateString("es-ES"),
        };
      });
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary["!cols"] = [
        { wch: 10 }, { wch: 50 }, { wch: 12 }, { wch: 14 },
        { wch: 14 }, { wch: 40 }, { wch: 12 },
      ];

      // Hoja 2: episodios detallados por anime
      const epRows: any[] = [];
      filtered.forEach((i) => {
        const eps = epsByTracker.get(i.id) || [];
        if (eps.length === 0) {
          epRows.push({
            "Anime": i.title,
            "AniList ID": i.anilist_id,
            "Episodio": "—",
            "Descargado": "—",
          });
        } else {
          eps.forEach((e) => {
            epRows.push({
              "Anime": i.title,
              "AniList ID": i.anilist_id,
              "Episodio": `EP ${e.episode_number}`,
              "Descargado": e.downloaded ? "Sí" : "No",
            });
          });
        }
      });
      const wsEps = XLSX.utils.json_to_sheet(epRows);
      wsEps["!cols"] = [{ wch: 50 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsSummary, "Animes");
      XLSX.utils.book_append_sheet(wb, wsEps, "Episodios");
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = filter === "year" ? `-${year}` : `-${filter}`;
      XLSX.writeFile(wb, `zetanime-completados${suffix}-${stamp}.xlsx`);
      toast.success(`Exportados ${filtered.length} animes (${epRows.length} episodios)`);
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
            <div className="w-9 h-9 rounded-lg bg-green-500/15 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">Exportar a Excel</h3>
              <p className="text-[10px] text-muted-foreground">Incluye animes y episodios detallados</p>
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? "Generando..." : "Descargar .xlsx"}
          </button>
        </div>
      </div>
    </div>
  );
}
