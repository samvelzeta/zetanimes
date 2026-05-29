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
}

export default function ReportBrokenLink({ slug, episodeNumber, animeTitle, animeCover, anilistId }: Props) {
  const { user } = useAuth();
  const { permissions } = usePlanPermissions();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState("");

  const report = async (type: "episode" | "full") => {
    if (!user) return toast.error("Inicia sesión para reportar");
    if (reason.trim().length < 500) return toast.error(`Describe el problema con al menos 500 caracteres (llevas ${reason.trim().length})`);
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
      const { data: existing } = await q.maybeSingle();

      if (existing) {
        // Only bump count if this user hasn't already reported it.
        const { data: already } = await supabase
          .from("broken_link_reporters")
          .select("id")
          .eq("report_id", existing.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!already) {
          await supabase.from("broken_link_reports")
            .update({
              report_count: existing.report_count + 1,
              last_reported_at: new Date().toISOString(),
              reason: reasonText,
              status: "pending", // re-abre si estaba "resolved" y vuelve a fallar
              priority_score: Math.max((existing as any).priority_score || 0, reporterPriority),
              highest_plan_slug: reporterPriority >= ((existing as any).priority_score || 0) ? reporterPlan : undefined,
              highest_priority_label: reporterPriority >= ((existing as any).priority_score || 0) ? reporterLabel : undefined,
            } as any)
            .eq("id", existing.id);
        }
        reportId = existing.id;
      } else {
        const { data: inserted } = await supabase
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
        reportId = (inserted as any)?.id || null;
      }

      // Track this reporter (idempotent thanks to UNIQUE(report_id,user_id)).
      if (reportId) {
        await supabase.from("broken_link_reporters")
          .insert({ report_id: reportId, user_id: user.id, plan_slug: reporterPlan, priority_label: reporterLabel, priority_score: reporterPriority } as any);
      }

      toast.success("Reporte enviado. Te avisaremos cuando lo solucionemos.");
      setOpen(false);
    } catch (e: any) {
      toast.error("Error al reportar");
    }
    setSending(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition">
        <AlertTriangle className="w-3.5 h-3.5" /> Reportar enlace caído
      </button>

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
                  <span className="text-muted-foreground font-normal ml-1">(mínimo 500 caracteres)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explica con detalle qué sucede: ¿pantalla negra, audio sin video, error específico, no carga, idioma equivocado, subtítulos rotos, etc.? Cuanto más detalle nos des, más rápido lo solucionamos."
                  className="w-full h-40 bg-secondary border border-border rounded-xl p-3 text-xs text-foreground resize-none focus:border-primary outline-none"
                  maxLength={3000}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-[10px] font-mono ${reason.trim().length >= 500 ? "text-green-500" : "text-muted-foreground"}`}>
                    {reason.trim().length}/500
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">¿Qué deseas reportar?</p>

              <button onClick={() => report("episode")} disabled={sending || reason.trim().length < 500}
                className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-bold hover:bg-destructive/20 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Capítulo {episodeNumber} no funciona
              </button>

              <button onClick={() => report("full")} disabled={sending || reason.trim().length < 500}
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
