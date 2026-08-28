import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Download, Loader2, X } from "lucide-react";

const TABLES_TO_EXPORT = [
  { key: "approved_animes", label: "Animes Aprobados" },
  { key: "video_cache", label: "Enlaces Seeke / Video Cache (sources completos)" },
  { key: "video_cache_blocks", label: "Bloques Seeke (configuracion por rangos)" },
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
  "adult_animes",
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

// Clave de conflicto por tabla → permite reimportar el .sql sobre una base
// existente (o vacía) sin duplicar filas: ON CONFLICT ... DO UPDATE.
const CONFLICT_KEYS: Record<string, string[]> = {
  approved_animes: ["anilist_id"],
  video_cache: ["slug", "episode", "lang"],
  video_cache_blocks: ["id"],
  slugs: ["anilist_id"],
  anime_status_overrides: ["id"],
  episode_count_overrides: ["id"],
  hidden_home_animes: ["id"],
  ranking_overrides: ["id"],
  auto_latest_episodes: ["anilist_id"],
  pending_anime_reserve: ["anilist_id"],
  hidden_pending_animes: ["id"],
  anime_download_tracker: ["id"],
  anime_episode_downloads: ["id"],
  anime_views: ["id"],
  anime_like_counts: ["anilist_id"],
  anime_synopsis_es: ["anilist_id"],
  admin_banners: ["id"],
  admin_frames: ["id"],
  premium_plan_configs: ["slug"],
  achievements: ["slug"],
  roleplay_missions: ["slug"],
  contact_links: ["id"],
  app_settings: ["id"],
  broken_link_reports: ["id"],
  adult_animes: ["anilist_id"],
};

function rowToInsert(table: string, row: Record<string, unknown>): string {
  const cols = Object.keys(row);
  const vals = cols.map((c) => escapeSQL(row[c]));
  const keys = CONFLICT_KEYS[table];
  let tail = ";";
  if (keys) {
    const updatable = cols.filter((c) => !keys.includes(c));
    tail = updatable.length
      ? ` ON CONFLICT (${keys.join(", ")}) DO UPDATE SET ${updatable.map((c) => `${c} = EXCLUDED.${c}`).join(", ")};`
      : ` ON CONFLICT (${keys.join(", ")}) DO NOTHING;`;
  }
  return `INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")})${tail}`;
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
    const tables = fullMode
      ? [...TABLES_TO_EXPORT.map((t) => t.key), ...EXTRA_TABLES_FULL]
      : TABLES_TO_EXPORT.filter((t) => selected.has(t.key)).map((t) => t.key);
    if (tables.length === 0) { toast.error("Selecciona al menos una tabla"); return; }
    setBusy(true);
    try {
      const lines: string[] = [
        "-- ZetAnimes SQL Backup (restaurable)",
        "-- Restaurar: psql <conn> -f este-archivo.sql   (o pegarlo en el editor SQL)",
        "-- Cada INSERT trae ON CONFLICT DO UPDATE: se puede reimportar encima sin duplicar.",
        `-- Generado: ${new Date().toISOString()}`,
        `-- Modo: ${fullMode ? "COMPLETO (todas las filas, sin límite)" : "Selección"}`,
        `-- Tablas: ${tables.join(", ")}`,
        "",
        "BEGIN;",
        "SET session_replication_role = replica; -- evita triggers durante la restauracion",
        "",
      ];

      let totalRows = 0;
      for (const tbl of tables) {
        setProgress(`Exportando ${tbl}…`);
        let rows: Record<string, unknown>[] = [];
        try {
          rows = await fetchAllRows(tbl, (n) => setProgress(`Exportando ${tbl}… ${n} filas`));
        } catch (e: any) {
          lines.push(`-- ERROR ${tbl}: ${e?.message || "desconocido"}`);
          continue;
        }
        if (rows.length === 0) { lines.push(`-- ${tbl}: vacía (0 filas)`); lines.push(""); continue; }

        totalRows += rows.length;
        lines.push(`-- =====================`);
        lines.push(`-- ${tbl} (${rows.length} filas)`);
        lines.push(`-- =====================`);
        rows.forEach((row) => lines.push(rowToInsert(tbl, row)));
        lines.push("");
      }

      lines.push("SET session_replication_role = DEFAULT;");
      lines.push("COMMIT;");
      const sqlText = lines.join("\n");
      // Comprimir con gzip: reduce drásticamente el tamaño del archivo
      // (típicamente 80-90% menos que el .sql plano).
      let blob: Blob;
      let ext = ".sql";
      try {
        const cs = new CompressionStream("gzip");
        const stream = new Blob([sqlText]).stream().pipeThrough(cs);
        blob = await new Response(stream).blob();
        ext = ".sql.gz";
      } catch {
        blob = new Blob([sqlText], { type: "text/sql" }); // fallback sin compresión
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zetanimes-backup${fullMode ? "-full" : ""}-${new Date().toISOString().slice(0, 10)}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      const savedKB = Math.round((sqlText.length - blob.size) / 1024);
      toast.success(`Backup SQL generado · ${tables.length} tablas · ${totalRows} filas${ext.endsWith("gz") ? ` · comprimido (ahorro ~${savedKB} KB)` : ""}`);
      onClose();
    } catch (err: any) {
      toast.error("Error: " + (err?.message || "desconocido"));
    } finally {
      setProgress("");
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
          <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${fullMode ? "border-amber-500 bg-amber-500/10" : "border-border bg-secondary/40"}`}>
            <input type="checkbox" checked={fullMode} onChange={() => setFullMode((v) => !v)} className="accent-amber-500 w-4 h-4" />
            <div>
              <span className="text-xs font-bold text-foreground">Descargar ABSOLUTAMENTE TODO</span>
              <p className="text-[10px] text-muted-foreground">Todas las tablas y todas las filas (paginado, sin límite de 1000). Incluye los ~1.100 animes, enlaces Seeke, slugs, reservas y config.</p>
            </div>
          </label>

          {!fullMode && TABLES_TO_EXPORT.map((t) => (
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
          <span className="text-[11px] text-muted-foreground truncate max-w-[55%]">
            {progress || (fullMode ? `${TABLES_TO_EXPORT.length + EXTRA_TABLES_FULL.length} tablas (todo)` : `${selected.size} tabla${selected.size !== 1 ? "s" : ""}`)}
          </span>
          <button onClick={handleExport} disabled={(!fullMode && selected.size === 0) || busy} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? "Generando..." : "Descargar .sql"}
          </button>
        </div>
      </div>
    </div>
  );
}
