import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, AlertTriangle, CheckCircle, Wrench } from "lucide-react";
import { toast } from "sonner";

type ReportStatus = "pending" | "fixing" | "resolved";

interface Report {
  id: string;
  slug: string;
  episode_number: number | null;
  report_type: string;
  anime_title: string | null;
  anime_cover: string | null;
  anilist_id: number | null;
  report_count: number;
  status: string;
  first_reported_at: string;
  last_reported_at: string;
}

const STATUS_MAP: { key: ReportStatus; label: string; color: string; icon: typeof AlertTriangle }[] = [
  { key: "pending", label: "Pendientes", color: "bg-yellow-600/20 text-yellow-400", icon: AlertTriangle },
  { key: "fixing", label: "En solución", color: "bg-blue-600/20 text-blue-400", icon: Wrench },
  { key: "resolved", label: "Resueltos", color: "bg-green-600/20 text-green-400", icon: CheckCircle },
];

export default function BrokenReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<ReportStatus>("pending");

  useEffect(() => { loadReports(); }, [activeStatus]);

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("broken_link_reports")
      .select("*")
      .eq("status", activeStatus)
      .order("report_count", { ascending: false })
      .limit(100);
    setReports((data as Report[]) || []);
    setLoading(false);
  };

  const changeStatus = async (id: string, newStatus: ReportStatus) => {
    const update: any = { status: newStatus };
    if (newStatus === "resolved") update.resolved_at = new Date().toISOString();
    await supabase.from("broken_link_reports").update(update).eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success(`Estado cambiado a ${newStatus}`);
  };

  const deleteReport = async (id: string) => {
    await supabase.from("broken_link_reports").delete().eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
    toast.success("Reporte eliminado");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-yellow-400" /> Reportes de Enlaces Caídos
      </h3>

      <div className="flex gap-2">
        {STATUS_MAP.map(s => (
          <button key={s.key} onClick={() => setActiveStatus(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${activeStatus === s.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            <s.icon className="w-3 h-3" /> {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : reports.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No hay reportes {activeStatus}</p>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="bg-secondary rounded-xl p-3 border border-border flex items-start gap-3">
              {r.anime_cover && <img src={r.anime_cover} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{r.anime_title || r.slug}</p>
                <p className="text-[10px] text-muted-foreground">
                  {r.report_type === "full" ? "Anime completo" : `Capítulo ${r.episode_number}`}
                  {" · "}<span className="text-primary font-bold">{r.report_count} reporte{r.report_count > 1 ? "s" : ""}</span>
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{r.slug}</p>
                <p className="text-[10px] text-muted-foreground">Último: {new Date(r.last_reported_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                {activeStatus === "pending" && (
                  <button onClick={() => changeStatus(r.id, "fixing")}
                    className="px-2 py-1 rounded-lg bg-blue-600/20 text-blue-400 text-[10px] font-bold hover:bg-blue-600/30 transition">
                    🔧 En solución
                  </button>
                )}
                {activeStatus === "fixing" && (
                  <button onClick={() => changeStatus(r.id, "resolved")}
                    className="px-2 py-1 rounded-lg bg-green-600/20 text-green-400 text-[10px] font-bold hover:bg-green-600/30 transition">
                    ✓ Resuelto
                  </button>
                )}
                {activeStatus === "resolved" && (
                  <button onClick={() => deleteReport(r.id)}
                    className="px-2 py-1 rounded-lg bg-destructive/20 text-destructive text-[10px] font-bold hover:bg-destructive/30 transition">
                    <Trash2 className="w-3 h-3 inline" /> Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
