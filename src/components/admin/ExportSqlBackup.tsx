import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Download, Loader2, X } from "lucide-react";

const TABLES_TO_EXPORT = [
  { key: "approved_animes", label: "Animes Aprobados" },
  { key: "video_cache", label: "Video Cache (Seeke)" },
  { key: "video_cache_blocks", label: "Bloques Seeke" },
  { key: "slugs", label: "Slugs" },
  { key: "anime_status_overrides", label: "Override Estados" },
  { key: "episode_count_overrides", label: "Override Episodios" },
  { key: "hidden_home_animes", label: "Ocultos Home" },
  { key: "ranking_overrides", label: "Override Ranking" },
  { key: "auto_latest_episodes", label: "Últimos Episodios" },
];

// Modo "TODO": incluye además catálogo, reservas, cosméticos y config.
const EXTRA_TABLES_FULL = [
  "pending_anime_reserve",
  "hidden_pending_animes",
  "anime_download_tracker",
  "anime_episode_downloads",
  "anime_views",
  "anime_like_counts",
  "anime_synopsis_es",
  "admin_banners",
  "admin_frames",
  "premium_plan_configs",
  "achievements",
  "roleplay_missions",
  "contact_links",
  "app_settings",
  "broken_link_reports",
];

const PAGE_SIZE = 1000;

/** Descarga TODAS las filas de una tabla paginando (sin el límite de 1000 de PostgREST). */
async function fetchAllRows(
  table: string,
  onProgress?: (n: number) => void,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = ((data || []) as unknown) as Record<string, unknown>[];
    out.push(...rows);
    onProgress?.(out.length);
    if (rows.length < PAGE_SIZE) break;
  }
  return out;
}

function escapeSQL(val: unknown): string {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function rowToInsert(table: string, row: Record<string, unknown>): string {
  const cols = Object.keys(row);
  const vals = cols.map((c) => escapeSQL(row[c]));
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${vals.join(", ")});`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ExportSqlBackup({ open, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const [fullMode, setFullMode] = useState(false);
  const [progress, setProgress] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set(TABLES_TO_EXPORT.map((t) => t.key)));

  if (!open) return null;

  const toggle = (key: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const handleExport = async () => {
    if (selected.size === 0) { toast.error("Selecciona al menos una tabla"); return; }
    setBusy(true);
    try {
      const lines: string[] = [
        "-- ZetAnimes SQL Backup",
        `-- Generado: ${new Date().toISOString()}`,
        `-- Tablas: ${[...selected].join(", ")}`,
        "",
      ];

      for (const tbl of TABLES_TO_EXPORT) {
        if (!selected.has(tbl.key)) continue;
        const { data, error } = await supabase.from(tbl.key as any).select("*");
        if (error) { lines.push(`-- ERROR ${tbl.key}: ${error.message}`); continue; }
        if (!data || data.length === 0) { lines.push(`-- ${tbl.key}: vacía (0 filas)`); lines.push(""); continue; }

        lines.push(`-- =====================`);
        lines.push(`-- ${tbl.key} (${data.length} filas)`);
        lines.push(`-- =====================`);
        data.forEach((row: any) => lines.push(rowToInsert(tbl.key, row)));
        lines.push("");
      }

      const blob = new Blob([lines.join("\n")], { type: "text/sql" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zetanimes-backup-${new Date().toISOString().slice(0, 10)}.sql`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup SQL generado (${[...selected].length} tablas)`);
      onClose();
    } catch (err: any) {
      toast.error("Error: " + (err?.message || "desconocido"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Database className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">Backup SQL Completo</h3>
              <p className="text-[10px] text-muted-foreground">Exporta tablas críticas como INSERT SQL</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
          {TABLES_TO_EXPORT.map((t) => (
            <label key={t.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${selected.has(t.key) ? "border-primary bg-primary/10" : "border-border bg-secondary/40"}`}>
              <input type="checkbox" checked={selected.has(t.key)} onChange={() => toggle(t.key)} className="accent-primary w-4 h-4" />
              <div>
                <span className="text-xs font-bold text-foreground">{t.label}</span>
                <p className="text-[10px] text-muted-foreground">{t.key}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{selected.size} tabla{selected.size !== 1 ? "s" : ""}</span>
          <button onClick={handleExport} disabled={selected.size === 0 || busy} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? "Generando..." : "Descargar .sql"}
          </button>
        </div>
      </div>
    </div>
  );
}
