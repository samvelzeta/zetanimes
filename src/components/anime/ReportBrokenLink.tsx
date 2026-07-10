import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { planLabel, planPriority } from "@/lib/premium-config";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  slug: string;
  episodeNumber: number;
  animeTitle: string;
  animeCover: string;
  anilistId: number;
  iconOnly?: boolean;
  className?: string;
}

export default function ReportBrokenLink({ slug, episodeNumber, animeTitle, animeCover, anilistId, iconOnly, className }: Props) {
  const { user } = useAuth();
  const { permissions } = usePlanPermissions();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState("");
  const reasonLength = reason.trim().length;

  const report = async (type: "episode" | "full") => {
    if (!user) return toast.error("Inicia sesión para reportar");
    if (reasonLength > 200) return toast.error("Máximo 200 caracteres");
    setSending(true);
    try {
      const epNum = type === "full" ? null : episodeNumber;
      const reasonText = reason.trim();
      const reporterPlan = permissions.slug === "free" ? null : permissions.slug;
      const reporterPriority = planPriority(reporterPlan);
      const reporterLabel = reporterPlan ? planLabel(reporterPlan) : null;
      let reportId: string | null = null;

      // Look up existing aggregated report.
      let q = supabase
        .from("broken_link_reports")
        .select("id, report_count, priority_score")
        .eq("slug", slug)
        .eq("report_type", type);
      q = epNum === null ? q.is("episode_number", null) : q.eq("episode_number", epNum);
      const { data: existing, error: lookupErr } = await q.maybeSingle();
      if (lookupErr) {
        console.error("[report] lookup error", lookupErr);
        throw lookupErr;
      }

      if (existing) {
        const { data: already } = await supabase
          .from("broken_link_reporters")
          .select("id")
          .eq("report_id", existing.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!already) {
          const { error: updErr } = await supabase.from("broken_link_reports")
            .update({
              report_count: existing.report_count + 1,
              last_reported_at: new Date().toISOString(),
              reason: reasonText,
              status: "pending",
              priority_score: Math.max((existing as any).priority_score || 0, reporterPriority),
              highest_plan_slug: reporterPriority >= ((existing as any).priority_score || 0) ? reporterPlan : undefined,
              highest_priority_label: reporterPriority >= ((existing as any).priority_score || 0) ? reporterLabel : undefined,
            } as any)
            .eq("id", existing.id);
          if (updErr) { console.error("[report] update error", updErr); throw updErr; }
        }
        reportId = existing.id;
      } else {
        const { data: inserted, error: insErr } = await supabase
          .from("broken_link_reports")
          .insert({
            slug, episode_number: epNum, report_type: type,
            anime_title: animeTitle, anime_cover: animeCover, anilist_id: anilistId,
            reason: reasonText,
            highest_plan_slug: reporterPlan,
            highest_priority_label: reporterLabel,
            priority_score: reporterPriority,
          } as any)
          .select("id")
          .single();
        if (insErr) { console.error("[report] insert error", insErr); throw insErr; }
        reportId = (inserted as any)?.id || null;
      }

      if (reportId) {
        const { error: repErr } = await supabase.from("broken_link_reporters")
          .insert({ report_id: reportId, user_id: user.id, plan_slug: reporterPlan, priority_label: reporterLabel, priority_score: reporterPriority } as any);
        if (repErr && repErr.code !== "23505") {
          // 23505 = unique violation (ya reportó): no es error real
          console.error("[report] reporter insert error", repErr);
        }
      } else {
        throw new Error("No se obtuvo ID de reporte");
      }

      toast.success("Reporte enviado. Te avisaremos cuando lo solucionemos.");
      setOpen(false);
    } catch (e: any) {
      console.error("[report] fallo total", e);
      toast.error(`Error al reportar: ${e?.message || "desconocido"}`);
    }
    setSending(false);
  };

  return (
    <>
      {iconOnly ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Reportar enlace caído"
          title="Reportar enlace caído"
          className={`w-8 h-8 rounded-full bg-black/55 backdrop-blur-sm border border-destructive/60 text-destructive flex items-center justify-center hover:bg-destructive/25 hover:text-white transition-all active:scale-95 shadow-[0_0_10px_hsl(var(--destructive)/0.4)] ${className || ""}`}
        >
          <AlertTriangle className="w-4 h-4" strokeWidth={2.5} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition">
          <AlertTriangle className="w-3.5 h-3.5" /> Reportar enlace caído
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl max-h-[90vh] overflow-y-auto hide-scrollbar" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" /> Reportar problema
                </h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1.5">
                  Describe el problema <span className="text-destructive">*</span>
                  <span className="text-muted-foreground font-normal ml-1">(máximo 200 caracteres)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe el problema: pantalla negra, audio sin video, no carga, idioma equivocado, subtítulos rotos, etc."
                  className="w-full h-40 bg-secondary border border-border rounded-xl p-3 text-xs text-foreground resize-none focus:border-primary outline-none"
                  maxLength={200}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-[10px] font-mono ${reasonLength >= 180 ? "text-destructive" : "text-muted-foreground"}`}>
                    {reasonLength}/200
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">¿Qué deseas reportar?</p>

              <button onClick={() => report("episode")} disabled={sending || reasonLength > 200}
                className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-bold hover:bg-destructive/20 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Capítulo {episodeNumber} no funciona
              </button>

              <button onClick={() => report("full")} disabled={sending || reasonLength > 200}
                className="w-full py-3 rounded-xl bg-yellow-600/10 border border-yellow-600/30 text-yellow-400 text-sm font-bold hover:bg-yellow-600/20 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Anime completo no funciona
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
