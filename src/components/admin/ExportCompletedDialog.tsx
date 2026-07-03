import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { X, FileSpreadsheet, Download } from "lucide-react";

export interface ExportTrackerItem {
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

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("No hay animes que exportar con ese filtro");
      return;
    }
    const rows = filtered.map((i) => ({
      "AniList ID": i.anilist_id,
      "Título": i.title,
      "Episodios": i.total_episodes ?? 0,
      "Estado emisión": i.airing_status ?? "—",
      "Géneros": (i.genres || []).join(", "),
      "Agregado": new Date(i.created_at).toLocaleDateString("es-ES"),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 10 }, { wch: 50 }, { wch: 10 }, { wch: 14 }, { wch: 40 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Completados");
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = filter === "year" ? `-${year}` : `-${filter}`;
    XLSX.writeFile(wb, `zetanime-completados${suffix}-${stamp}.xlsx`);
    toast.success(`Exportados ${filtered.length} animes`);
    onClose();
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
              <p className="text-[10px] text-muted-foreground">Elige qué animes incluir</p>
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
            disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Descargar .xlsx
          </button>
        </div>
      </div>
    </div>
  );
}
