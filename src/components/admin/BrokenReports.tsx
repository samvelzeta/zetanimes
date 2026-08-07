import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trash2, AlertTriangle, CheckCircle, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { logAdminActivity } from "@/lib/admin-log";
import { planLabel } from "@/lib/premium-config";
import { useAuth } from "@/contexts/AuthContext";

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
  reason: string | null;
  highest_plan_slug: string | null;
  highest_priority_label: string | null;
  priority_score: number;
  first_reported_at: string;
  last_reported_at: string;
}

const STATUS_MAP: { key: ReportStatus; label: string; color: string; icon: typeof AlertTriangle }[] = [
  { key: "pending", label: "Pendientes", color: "bg-yellow-600/20 text-yellow-400", icon: AlertTriangle },
  { key: "fixing", label: "En solución", color: "bg-blue-600/20 text-blue-400", icon: Wrench },
  { key: "resolved", label: "Resueltos", color: "bg-green-600/20 text-green-400", icon: CheckCircle },
];

export default function BrokenReports() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<ReportStatus>("pending");
  const [resolveTarget, setResolveTarget] = useState<Report | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { loadReports(); }, [activeStatus]);

  const loadReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("broken_link_reports")
      .select("*")
      .eq("status", activeStatus)
      .order("priority_score", { ascending: false })
      .order("report_count", { ascending: false })
      .limit(100);
    setReports((data as Report[]) || []);
    setLoading(false);
  };

  const openResolveDialog = (r: Report) => {
    setResolveTarget(r);
    setCustomMessage("");
  };

  const confirmResolve = async () => {
    if (!resolveTarget) return;
    setSending(true);
    const r = resolveTarget;
    try {
      await supabase
        .from("broken_link_reports")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", r.id);

      const { data: reporters } = await supabase
        .from("broken_link_reporters")
        .select("user_id")
        .eq("report_id", r.id);
      const userIds = Array.from(new Set(((reporters as any[]) || []).map((x) => x.user_id))).filter(Boolean);

      const epLabel = r.episode_number ? ` (Capítulo ${r.episode_number})` : "";
      const defaultMsg = `"${r.anime_title || r.slug}"${epLabel} fue solucionado. Ya puedes volver a disfrutarlo desde donde lo dejaste.`;
      const finalMsg = customMessage.trim() ? customMessage.trim() : defaultMsg;
      const link = r.anilist_id ? `/anime/${r.anilist_id}` : (r.slug ? `/anime/${r.slug}` : null);

      if (userIds.length > 0) {
        const rows = userIds.map((uid) => ({
          title: "¡Tu anime ya está disponible! 🎉",
          message: finalMsg,
          type: "success",
          target_user_id: uid,
          image_url: r.anime_cover || null,
          link,
          active: true,
        }));
        await supabase.from("notifications").insert(rows as any);
        await supabase.from("broken_link_reporters").delete().eq("report_id", r.id);
      }

      // Notificación interna para el admin que resolvió
      if (user) {
        await supabase.from("notifications").insert({
          title: "✅ Reporte resuelto",
          message: `Notificaste a ${userIds.length} usuario${userIds.length === 1 ? "" : "s"} sobre "${r.anime_title || r.slug}"${epLabel}.`,
          type: "info",
          target_user_id: user.id,
          image_url: r.anime_cover || null,
          active: true,
        });
      }

      setReports((prev) => prev.filter((x) => x.id !== r.id));
      await logAdminActivity({
        area: "reports",
        action: "status_change",
        summary: `Reporte ${r.report_type} "${r.anime_title || r.slug}"${r.episode_number ? ` ep ${r.episode_number}` : ""} → resolved (${userIds.length} notificados)`,
        anilist_id: r.anilist_id ?? null,
        anime_title: r.anime_title,
        episode_number: r.episode_number ?? null,
      });
      toast.success(`Resuelto. ${userIds.length} usuario${userIds.length === 1 ? "" : "s"} notificado${userIds.length === 1 ? "" : "s"}`);
      setResolveTarget(null);
    } catch (e: any) {
      toast.error(e.message || "Error al resolver");
    } finally {
      setSending(false);
    }
  };

  const changeStatus = async (id: string, newStatus: ReportStatus) => {
    const r = reports.find((x) => x.id === id);
    if (newStatus === "resolved" && r) {
      openResolveDialog(r);
      return;
    }
    await supabase.from("broken_link_reports").update({ status: newStatus }).eq("id", id);
    setReports((prev) => prev.filter((x) => x.id !== id));
    await logAdminActivity({
      area: "reports", action: "status_change",
      summary: `Reporte ${r?.report_type} "${r?.anime_title || r?.slug}"${r?.episode_number ? ` ep ${r.episode_number}` : ""} → ${newStatus}`,
      anilist_id: r?.anilist_id ?? null, anime_title: r?.anime_title, episode_number: r?.episode_number ?? null,
    });
    toast.success(`Estado cambiado a ${newStatus}`);
  };

  const deleteReport = async (id: string) => {
    const r = reports.find((x) => x.id === id);
    await supabase.from("broken_link_reports").delete().eq("id", id);
    setReports(prev => prev.filter(r => r.id !== id));
    await logAdminActivity({
      area: "reports", action: "delete",
      summary: `Eliminó reporte de "${r?.anime_title || r?.slug}"`,
      anilist_id: r?.anilist_id ?? null, anime_title: r?.anime_title,
    });
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
                {r.highest_plan_slug && (
                  <span className="mt-1 inline-flex px-2 py-0.5 rounded-full bg-primary/15 border border-primary/30 text-[9px] font-black text-primary uppercase">
                    Prioridad {r.highest_priority_label || planLabel(r.highest_plan_slug)}
                  </span>
                )}
                <p className="text-[10px] text-muted-foreground font-mono">{r.slug}</p>
                <p className="text-[10px] text-muted-foreground">Último: {new Date(r.last_reported_at).toLocaleString()}</p>
                {r.reason && (
                  <div className="mt-2 p-2 rounded-lg bg-background border border-border">
                    <p className="text-[10px] font-bold text-primary mb-0.5">Motivo del reporte:</p>
                    <p className="text-[11px] text-foreground whitespace-pre-wrap leading-relaxed">{r.reason}</p>
                  </div>
                )}
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

      {/* Modal de confirmación con mensaje opcional */}
      {resolveTarget && (
        <div className="fixed inset-0 z-[150] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-primary/40 rounded-2xl max-w-md w-full p-5 shadow-2xl shadow-primary/30">
            <div className="flex items-start justify-between mb-3">
              <h4 className="text-sm font-black text-foreground">Notificar a los reporters</h4>
              <button onClick={() => setResolveTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              <strong className="text-foreground">{resolveTarget.anime_title || resolveTarget.slug}</strong>
              {resolveTarget.episode_number ? ` · Cap ${resolveTarget.episode_number}` : ""}
            </p>
            <label className="block text-[11px] font-bold text-foreground mb-1">
              Mensaje personalizado (opcional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value.slice(0, 300))}
              placeholder="Dejar vacío para usar el mensaje por defecto"
              className="w-full h-24 px-3 py-2 rounded-lg bg-background border border-border text-xs resize-none focus:outline-none focus:border-primary"
            />
            <p className="text-[10px] text-muted-foreground text-right mt-1">{customMessage.length}/300</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setResolveTarget(null)}
                disabled={sending}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary text-foreground text-xs font-bold hover:bg-muted transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmResolve}
                disabled={sending}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                {sending ? "Enviando…" : "Resolver y notificar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
